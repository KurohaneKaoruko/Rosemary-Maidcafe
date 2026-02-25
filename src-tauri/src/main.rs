#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod secure_save;
mod staffing_sim;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            secure_save::save_secure_state,
            secure_save::load_secure_state,
            secure_save::delete_secure_state,
            secure_save::has_secure_state,
            secure_save::get_secure_state_info,
            staffing_sim::simulate_staffing_tick
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
