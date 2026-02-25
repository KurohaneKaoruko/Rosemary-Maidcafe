use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

type HmacSha256 = Hmac<Sha256>;

const SAVE_FILE_NAME: &str = "save.sec";
const SAVE_ALGORITHM: &str = "AES-256-GCM+HMAC-SHA256";
const SAVE_FILE_VERSION: u32 = 2;
const SAVE_PAYLOAD_MAX_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecureSaveInfo {
    pub version: String,
    pub timestamp: i64,
    pub day: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptedSaveContainer {
    v: u32,
    alg: String,
    nonce: String,
    ciphertext: String,
    mac: String,
    meta: SecureSaveInfo,
}

#[tauri::command]
pub fn save_secure_state(app: AppHandle, payload: String) -> Result<(), String> {
    if payload.is_empty() {
        return Err("存档内容为空".to_string());
    }
    if payload.len() > SAVE_PAYLOAD_MAX_BYTES {
        return Err("存档体积超出限制".to_string());
    }

    let meta = extract_meta(&payload)?;
    let (enc_key, mac_key) = derive_keys(&app)?;

    let mut nonce = [0_u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce);

    let aad = serialize_meta(&meta)?;
    let cipher = Aes256Gcm::new_from_slice(&enc_key)
        .map_err(|err| format!("创建加密器失败: {err}"))?;
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: payload.as_bytes(),
                aad: &aad,
            },
        )
        .map_err(|_| "存档加密失败".to_string())?;

    let mac_bytes = compute_mac(
        &mac_key,
        SAVE_FILE_VERSION,
        SAVE_ALGORITHM,
        &nonce,
        &ciphertext,
        &meta,
    )?;

    let container = EncryptedSaveContainer {
        v: SAVE_FILE_VERSION,
        alg: SAVE_ALGORITHM.to_string(),
        nonce: BASE64_STANDARD.encode(nonce),
        ciphertext: BASE64_STANDARD.encode(ciphertext),
        mac: BASE64_STANDARD.encode(mac_bytes),
        meta,
    };

    let content = serde_json::to_string(&container).map_err(|err| format!("序列化存档失败: {err}"))?;
    write_save_file(&app, content.as_bytes())
}

#[tauri::command]
pub fn load_secure_state(app: AppHandle) -> Result<Option<String>, String> {
    let path = get_save_file_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|err| format!("读取存档失败: {err}"))?;
    let container: EncryptedSaveContainer =
        serde_json::from_str(&content).map_err(|_| "存档格式无效".to_string())?;

    if container.v != SAVE_FILE_VERSION || container.alg != SAVE_ALGORITHM {
        return Err("存档版本不受支持".to_string());
    }

    let nonce = decode_fixed_len("nonce", &container.nonce, 12)?;
    let ciphertext =
        BASE64_STANDARD.decode(container.ciphertext.as_bytes()).map_err(|_| "存档密文损坏".to_string())?;
    let mac =
        BASE64_STANDARD.decode(container.mac.as_bytes()).map_err(|_| "存档签名损坏".to_string())?;

    let (enc_key, mac_key) = derive_keys(&app)?;
    verify_mac(
        &mac_key,
        container.v,
        &container.alg,
        &nonce,
        &ciphertext,
        &container.meta,
        &mac,
    )?;

    let aad = serialize_meta(&container.meta)?;
    let cipher = Aes256Gcm::new_from_slice(&enc_key)
        .map_err(|err| format!("创建解密器失败: {err}"))?;
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: ciphertext.as_ref(),
                aad: &aad,
            },
        )
        .map_err(|_| "存档解密失败，可能来自其他设备或已被篡改".to_string())?;

    let payload = String::from_utf8(plaintext).map_err(|_| "存档内容损坏".to_string())?;
    Ok(Some(payload))
}

#[tauri::command]
pub fn delete_secure_state(app: AppHandle) -> Result<(), String> {
    let path = get_save_file_path(&app)?;
    if !path.exists() {
        return Ok(());
    }

    fs::remove_file(path).map_err(|err| format!("删除存档失败: {err}"))
}

#[tauri::command]
pub fn has_secure_state(app: AppHandle) -> Result<bool, String> {
    Ok(get_save_file_path(&app)?.exists())
}

#[tauri::command]
pub fn get_secure_state_info(app: AppHandle) -> Result<Option<SecureSaveInfo>, String> {
    let path = get_save_file_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|err| format!("读取存档失败: {err}"))?;
    let container: EncryptedSaveContainer =
        serde_json::from_str(&content).map_err(|_| "存档格式无效".to_string())?;

    if container.v != SAVE_FILE_VERSION || container.alg != SAVE_ALGORITHM {
        return Err("存档版本不受支持".to_string());
    }

    let nonce = decode_fixed_len("nonce", &container.nonce, 12)?;
    let ciphertext =
        BASE64_STANDARD.decode(container.ciphertext.as_bytes()).map_err(|_| "存档密文损坏".to_string())?;
    let mac =
        BASE64_STANDARD.decode(container.mac.as_bytes()).map_err(|_| "存档签名损坏".to_string())?;

    let (_, mac_key) = derive_keys(&app)?;
    verify_mac(
        &mac_key,
        container.v,
        &container.alg,
        &nonce,
        &ciphertext,
        &container.meta,
        &mac,
    )?;

    Ok(Some(container.meta))
}

fn get_save_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("获取存档目录失败: {err}"))?;
    Ok(app_data_dir.join(SAVE_FILE_NAME))
}

fn write_save_file(app: &AppHandle, content: &[u8]) -> Result<(), String> {
    let path = get_save_file_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "存档目录不可用".to_string())?;

    fs::create_dir_all(parent).map_err(|err| format!("创建存档目录失败: {err}"))?;
    let tmp_path = make_tmp_path(&path);
    fs::write(&tmp_path, content).map_err(|err| format!("写入临时存档失败: {err}"))?;
    fs::rename(&tmp_path, &path).map_err(|err| format!("保存存档失败: {err}"))?;
    Ok(())
}

fn make_tmp_path(path: &Path) -> PathBuf {
    let mut tmp = path.to_path_buf();
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(SAVE_FILE_NAME);
    tmp.set_file_name(format!("{file_name}.tmp"));
    tmp
}

fn extract_meta(payload: &str) -> Result<SecureSaveInfo, String> {
    let value: serde_json::Value =
        serde_json::from_str(payload).map_err(|_| "存档内容格式无效".to_string())?;

    let version = value
        .get("version")
        .and_then(|item| item.as_str())
        .ok_or_else(|| "存档缺少版本信息".to_string())?
        .to_string();

    let timestamp = value
        .get("timestamp")
        .and_then(|item| item.as_i64())
        .ok_or_else(|| "存档缺少时间戳".to_string())?;

    let day_raw = value
        .get("day")
        .and_then(|item| item.as_u64())
        .ok_or_else(|| "存档缺少天数信息".to_string())?;
    let day = u32::try_from(day_raw).map_err(|_| "存档天数超出范围".to_string())?;

    Ok(SecureSaveInfo {
        version,
        timestamp,
        day,
    })
}

fn serialize_meta(meta: &SecureSaveInfo) -> Result<Vec<u8>, String> {
    serde_json::to_vec(meta).map_err(|err| format!("序列化元数据失败: {err}"))
}

fn build_mac_input(
    version: u32,
    alg: &str,
    nonce: &[u8],
    ciphertext: &[u8],
    meta: &SecureSaveInfo,
) -> Result<Vec<u8>, String> {
    let meta_bytes = serialize_meta(meta)?;
    let mut data = Vec::with_capacity(
        4 + 4 + alg.len() + 4 + nonce.len() + 4 + ciphertext.len() + 4 + meta_bytes.len(),
    );

    data.extend_from_slice(&version.to_le_bytes());
    data.extend_from_slice(&(alg.len() as u32).to_le_bytes());
    data.extend_from_slice(alg.as_bytes());
    data.extend_from_slice(&(nonce.len() as u32).to_le_bytes());
    data.extend_from_slice(nonce);
    data.extend_from_slice(&(ciphertext.len() as u32).to_le_bytes());
    data.extend_from_slice(ciphertext);
    data.extend_from_slice(&(meta_bytes.len() as u32).to_le_bytes());
    data.extend_from_slice(&meta_bytes);
    Ok(data)
}

fn compute_mac(
    mac_key: &[u8; 32],
    version: u32,
    alg: &str,
    nonce: &[u8],
    ciphertext: &[u8],
    meta: &SecureSaveInfo,
) -> Result<Vec<u8>, String> {
    let payload = build_mac_input(version, alg, nonce, ciphertext, meta)?;
    let mut mac =
        <HmacSha256 as Mac>::new_from_slice(mac_key).map_err(|err| format!("创建签名器失败: {err}"))?;
    mac.update(&payload);
    Ok(mac.finalize().into_bytes().to_vec())
}

fn verify_mac(
    mac_key: &[u8; 32],
    version: u32,
    alg: &str,
    nonce: &[u8],
    ciphertext: &[u8],
    meta: &SecureSaveInfo,
    mac_value: &[u8],
) -> Result<(), String> {
    let payload = build_mac_input(version, alg, nonce, ciphertext, meta)?;
    let mut mac =
        <HmacSha256 as Mac>::new_from_slice(mac_key).map_err(|err| format!("创建签名器失败: {err}"))?;
    mac.update(&payload);
    mac.verify_slice(mac_value)
        .map_err(|_| "存档签名校验失败，数据可能已被篡改".to_string())
}

fn decode_fixed_len(label: &str, encoded: &str, expected_len: usize) -> Result<Vec<u8>, String> {
    let decoded = BASE64_STANDARD
        .decode(encoded.as_bytes())
        .map_err(|_| format!("存档{label}数据损坏"))?;
    if decoded.len() != expected_len {
        return Err(format!("存档{label}长度无效"));
    }
    Ok(decoded)
}

fn derive_keys(app: &AppHandle) -> Result<([u8; 32], [u8; 32]), String> {
    let device_id = get_device_binding_id();
    let app_id = app.config().identifier.clone();
    let mut seed_hasher = Sha256::new();
    seed_hasher.update(b"rosemary-maidcafe::secure-save::v2");
    seed_hasher.update(app_id.as_bytes());
    seed_hasher.update(device_id.as_bytes());
    let seed = seed_hasher.finalize();

    let mut enc_hasher = Sha256::new();
    enc_hasher.update(seed);
    enc_hasher.update(b"enc");
    let enc_bytes = enc_hasher.finalize();

    let mut mac_hasher = Sha256::new();
    mac_hasher.update(seed);
    mac_hasher.update(b"mac");
    let mac_bytes = mac_hasher.finalize();

    let mut enc_key = [0_u8; 32];
    enc_key.copy_from_slice(&enc_bytes);
    let mut mac_key = [0_u8; 32];
    mac_key.copy_from_slice(&mac_bytes);

    Ok((enc_key, mac_key))
}

fn get_device_binding_id() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Some(machine_guid) = read_windows_machine_guid() {
            return machine_guid;
        }
    }

    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "unknown-host".to_string());
    let username = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "unknown-user".to_string());
    format!("{hostname}:{username}:{}", std::env::consts::ARCH)
}

#[cfg(target_os = "windows")]
fn read_windows_machine_guid() -> Option<String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm
        .open_subkey("SOFTWARE\\Microsoft\\Cryptography")
        .ok()?;
    let value: String = key.get_value("MachineGuid").ok()?;
    if value.trim().is_empty() {
        None
    } else {
        Some(value.trim().to_string())
    }
}
