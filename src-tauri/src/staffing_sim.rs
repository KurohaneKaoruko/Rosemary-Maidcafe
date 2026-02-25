use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const SHIFT_MORNING: &str = "morning";
const SHIFT_PEAK: &str = "peak";
const SHIFT_EVENING: &str = "evening";
const SEASON_SPRING: &str = "spring";
const SEASON_SUMMER: &str = "summer";
const SEASON_AUTUMN: &str = "autumn";
const SEASON_WINTER: &str = "winter";

const ROLE_SERVER: &str = "server";
const ROLE_BARISTA: &str = "barista";
const ROLE_GREETER: &str = "greeter";
const ROLE_ENTERTAINER: &str = "entertainer";

const STATUS_SEATED: &str = "seated";
const STATUS_WAITING_ORDER: &str = "waiting_order";
const STATUS_EATING: &str = "eating";
const STATUS_PAYING: &str = "paying";
const STATUS_LEAVING: &str = "leaving";

const INCIDENT_HISTORY_LIMIT: usize = 20;
const SPAWN_CANDIDATE_MAX: usize = 3;

const CUSTOMER_FIRST_NAMES: &[&str] = &[
    "小明", "小红", "小华", "小丽", "小强", "小芳", "小军", "小燕",
    "阿杰", "阿美", "阿伟", "阿玲", "大卫", "玛丽", "约翰", "艾米",
    "太郎", "花子", "健一", "美咲", "翔太", "由美", "拓也", "真由",
];

const CUSTOMER_LAST_NAMES: &[&str] = &[
    "王", "李", "张", "刘", "陈", "杨", "黄", "赵",
    "周", "吴", "徐", "孙", "马", "朱", "胡", "郭",
];

const CUSTOMER_AVATARS: &[&str] = &[
    "👤", "👨", "👩", "🧑", "👴", "👵", "👦", "👧",
    "🧔", "👱", "👸", "🤴", "🧑‍💼", "👨‍💼", "👩‍💼", "🧑‍🎓",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulateStaffingInput {
    pub day: u32,
    pub time: u32,
    pub delta_minutes: f64,
    pub waiting_count: u32,
    pub base_spawn_interval_ms: u32,
    pub customer_spawn_ms: f64,
    #[serde(default)]
    pub customer_status_ticks: HashMap<String, u32>,
    #[serde(default)]
    pub customer_streak: u32,
    #[serde(default)]
    pub occupied_seat_ids: Vec<String>,
    pub max_seats: u32,
    pub occupied_seat_count: u32,
    pub reputation: f64,
    pub season: String,
    pub menu_items: Vec<MenuItemState>,
    pub maids: Vec<MaidState>,
    pub customers: Vec<CustomerState>,
    pub staffing: StaffingState,
    pub active_incident: Option<IncidentState>,
    pub incident_history: Vec<IncidentState>,
    pub now_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulateStaffingOutput {
    pub maids: Vec<MaidState>,
    pub staffing: StaffingState,
    pub active_incident: Option<IncidentState>,
    pub incident_history: Vec<IncidentState>,
    pub notifications: Vec<NotificationState>,
    pub frame: NativeStaffingFrame,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStaffingFrame {
    pub shift: String,
    pub waiting_count: u32,
    pub spawn_interval_ms: u32,
    pub maid_profiles: HashMap<String, NativeMaidProfile>,
    pub customer_profiles: HashMap<String, NativeCustomerProfile>,
    pub service_outcomes: HashMap<String, NativeServiceOutcomeProfile>,
    pub service_progress_updates: HashMap<String, NativeServiceProgressUpdate>,
    pub service_metrics: NativeServiceMetrics,
    pub customer_status_ticks: HashMap<String, u32>,
    pub customer_status_updates: HashMap<String, String>,
    pub removed_customer_ids: Vec<String>,
    pub service_assignments: Vec<NativeServiceAssignment>,
    pub spawn_plan: NativeSpawnPlan,
    pub spawn_candidates: Vec<NativeSpawnCandidate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSpawnPlan {
    pub spawn_count: u32,
    pub next_spawn_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeServiceAssignment {
    pub maid_id: String,
    pub customer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeMaidProfile {
    pub base_service_progress_delta: f64,
    pub service_progress_multiplier: f64,
    pub satisfaction_bonus: f64,
    pub service_score: f64,
    pub role_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCustomerProfile {
    pub next_patience: f64,
    pub should_leave: bool,
    pub reputation_penalty: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeServiceOutcomeProfile {
    pub satisfaction: f64,
    pub gold: f64,
    pub tip: f64,
    pub reputation: f64,
    pub maid_experience: f64,
    pub combo_multiplier: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeServiceProgressUpdate {
    pub next_progress: f64,
    pub completed: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeServiceMetrics {
    pub completed_count: u32,
    pub completed_vip_count: u32,
    pub gold_total: f64,
    pub tip_total: f64,
    pub reputation_total: f64,
    pub max_satisfaction: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSpawnCandidate {
    pub id: String,
    #[serde(rename = "type")]
    pub customer_type: String,
    pub name: String,
    pub avatar: String,
    pub patience: f64,
    pub satisfaction: f64,
    pub arrival_time: u64,
    #[serde(default)]
    pub seat_id: String,
    pub order: NativeOrder,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeOrder {
    #[serde(default)]
    pub items: Vec<NativeOrderItem>,
    #[serde(default)]
    pub total_price: f64,
    #[serde(default)]
    pub prepared_items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeOrderItem {
    pub menu_item_id: String,
    pub quantity: u32,
    pub prepared: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaidState {
    pub id: String,
    pub name: String,
    pub avatar: String,
    pub personality: String,
    pub stats: MaidStats,
    pub experience: f64,
    pub level: u32,
    pub role: String,
    pub status: MaidStatus,
    pub mood: f64,
    pub stamina: f64,
    pub fatigue: f64,
    pub consecutive_work_days: u32,
    pub preferred_shift: String,
    pub skill_points: u32,
    pub skills: MaidSkills,
    pub hire_date: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerState {
    pub id: String,
    #[serde(rename = "type")]
    pub customer_type: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub patience: f64,
    #[serde(default)]
    pub order: CustomerOrder,
    #[serde(default)]
    pub service_start_time: Option<u64>,
    #[serde(default)]
    pub serving_maid_id: Option<String>,
    #[serde(default)]
    pub service_progress: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerOrder {
    #[serde(default)]
    pub total_price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuItemState {
    pub id: String,
    #[serde(default)]
    pub unlocked: bool,
    #[serde(default)]
    pub current_price: f64,
    #[serde(default)]
    pub popularity: f64,
    #[serde(default)]
    pub season: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaidStats {
    pub charm: f64,
    pub skill: f64,
    pub stamina: f64,
    pub speed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaidStatus {
    pub is_working: bool,
    pub is_resting: bool,
    pub current_task: Option<String>,
    pub serving_customer_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaidSkills {
    #[serde(default)]
    pub service: f64,
    #[serde(default)]
    pub guest_care: f64,
    #[serde(default)]
    pub emergency: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffingState {
    pub shifts: StaffingShifts,
    pub auto_rest: StaffingAutoRestConfig,
    pub active_boost: Option<StaffingBoostState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffingShifts {
    pub morning: StaffingShiftConfig,
    pub peak: StaffingShiftConfig,
    pub evening: StaffingShiftConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffingShiftConfig {
    pub role_priority: Vec<String>,
    pub allow_cross_role: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffingAutoRestConfig {
    pub enabled: bool,
    pub stamina_threshold: f64,
    pub mood_threshold: f64,
    pub fatigue_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffingBoostState {
    pub source: String,
    pub remaining_minutes: f64,
    pub spawn_rate_multiplier: f64,
    pub service_efficiency_multiplier: f64,
    pub satisfaction_bonus: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncidentState {
    pub id: String,
    pub icon: String,
    pub title: String,
    pub description: String,
    pub remaining_minutes: f64,
    pub options: Vec<IncidentOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncidentOption {
    pub id: String,
    pub label: String,
    pub description: String,
    pub reputation_delta: Option<f64>,
    pub gold_delta: Option<f64>,
    pub mood_delta: Option<f64>,
    pub fatigue_delta: Option<f64>,
    pub spawn_rate_multiplier: Option<f64>,
    pub service_efficiency_multiplier: Option<f64>,
    pub satisfaction_bonus: Option<f64>,
    pub duration_minutes: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationState {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub message: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone)]
struct IncidentTemplate {
    id: &'static str,
    icon: &'static str,
    title: &'static str,
    description: &'static str,
    duration_minutes: f64,
    options: Vec<IncidentOption>,
}

#[tauri::command]
pub fn simulate_staffing_tick(input: SimulateStaffingInput) -> Result<SimulateStaffingOutput, String> {
    let delta_minutes = clamp(input.delta_minutes, 1.0, 30.0);
    let waiting_count = input.waiting_count.min(200);
    let now_ms = if input.now_ms == 0 { 1 } else { input.now_ms };
    let shift = get_current_shift(f64::from(input.time));
    let season = sanitize_season(&input.season).to_string();
    let reputation = clamp(input.reputation, 0.0, 100.0);
    let customer_spawn_ms = input.customer_spawn_ms.max(0.0);
    let customer_status_ticks = normalize_customer_status_ticks(input.customer_status_ticks);
    let customer_streak = input.customer_streak.min(200);
    let max_seats = input.max_seats.max(1);
    let occupied_seat_ids = normalize_occupied_seat_ids(input.occupied_seat_ids, max_seats);
    let occupied_seat_count = (occupied_seat_ids.len() as u32).min(max_seats);
    let menu_items = input
        .menu_items
        .into_iter()
        .map(normalize_menu_item_state)
        .collect::<Vec<_>>();

    let mut staffing = normalize_staffing(input.staffing);
    tick_staffing_boost(&mut staffing, delta_minutes);

    let mut notifications: Vec<NotificationState> = Vec::new();
    let mut seq = 0_u64;

    let mut maids = input
        .maids
        .into_iter()
        .map(normalize_maid_state)
        .collect::<Vec<_>>();
    let customers = input
        .customers
        .into_iter()
        .map(normalize_customer_state)
        .collect::<Vec<_>>();

    for maid in &mut maids {
        apply_maid_tick(
            maid,
            &staffing,
            delta_minutes,
            now_ms,
            &mut seq,
            &mut notifications,
        );
    }

    let mut active_incident = input.active_incident.map(normalize_incident_state);
    let mut incident_history = input
        .incident_history
        .into_iter()
        .map(normalize_incident_state)
        .collect::<Vec<_>>();

    tick_active_incident(
        &mut active_incident,
        delta_minutes,
        now_ms,
        &mut seq,
        &mut notifications,
    );

    if active_incident.is_none() {
        if let Some(incident) = roll_operational_incident(input.day, shift, waiting_count, now_ms) {
            notifications.push(NotificationState {
                id: format!("incident_trigger_{}_{}", incident.id, now_ms + seq),
                kind: "warning".to_string(),
                message: format!("{} {}（请前往女仆管理处理）", incident.icon, incident.title),
                timestamp: now_ms + seq,
            });
            incident_history.push(incident.clone());
            active_incident = Some(incident);
        }
    }

    if incident_history.len() > INCIDENT_HISTORY_LIMIT {
        let keep_from = incident_history.len() - INCIDENT_HISTORY_LIMIT;
        incident_history = incident_history.split_off(keep_from);
    }

    let frame = build_native_frame(
        &maids,
        &customers,
        &menu_items,
        &staffing,
        reputation,
        &season,
        customer_spawn_ms,
        &customer_status_ticks,
        customer_streak,
        &occupied_seat_ids,
        max_seats,
        occupied_seat_count,
        input.day,
        shift,
        waiting_count,
        delta_minutes,
        now_ms,
        f64::from(input.base_spawn_interval_ms),
    );

    Ok(SimulateStaffingOutput {
        maids,
        staffing,
        active_incident,
        incident_history,
        notifications,
        frame,
    })
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn get_current_shift(time: f64) -> &'static str {
    let clamped = clamp(time, 540.0, 1260.0);
    if clamped < 720.0 {
        SHIFT_MORNING
    } else if clamped < 1080.0 {
        SHIFT_PEAK
    } else {
        SHIFT_EVENING
    }
}

fn sanitize_shift(value: &str) -> &'static str {
    match value {
        SHIFT_MORNING => SHIFT_MORNING,
        SHIFT_PEAK => SHIFT_PEAK,
        SHIFT_EVENING => SHIFT_EVENING,
        _ => SHIFT_PEAK,
    }
}

fn sanitize_season(value: &str) -> &'static str {
    match value {
        SEASON_SPRING => SEASON_SPRING,
        SEASON_SUMMER => SEASON_SUMMER,
        SEASON_AUTUMN => SEASON_AUTUMN,
        SEASON_WINTER => SEASON_WINTER,
        _ => SEASON_SPRING,
    }
}

fn normalize_menu_item_state(mut item: MenuItemState) -> MenuItemState {
    item.current_price = item.current_price.max(0.0);
    item.popularity = clamp(item.popularity, 0.0, 100.0);
    item.season = item.season.map(|season| sanitize_season(&season).to_string());
    item
}

fn default_priority_for_shift(shift: &str) -> Vec<String> {
    match shift {
        SHIFT_MORNING => vec![
            ROLE_GREETER.to_string(),
            ROLE_SERVER.to_string(),
            ROLE_BARISTA.to_string(),
            ROLE_ENTERTAINER.to_string(),
        ],
        SHIFT_EVENING => vec![
            ROLE_ENTERTAINER.to_string(),
            ROLE_SERVER.to_string(),
            ROLE_BARISTA.to_string(),
            ROLE_GREETER.to_string(),
        ],
        _ => vec![
            ROLE_SERVER.to_string(),
            ROLE_BARISTA.to_string(),
            ROLE_GREETER.to_string(),
            ROLE_ENTERTAINER.to_string(),
        ],
    }
}

fn normalize_role_priority(priority: Vec<String>, shift: &str) -> Vec<String> {
    let defaults = default_priority_for_shift(shift);
    let mut result: Vec<String> = Vec::new();

    for role in priority {
        if is_known_role(&role) && !result.contains(&role) {
            result.push(role);
        }
    }

    for role in defaults {
        if !result.contains(&role) {
            result.push(role);
        }
    }

    result.truncate(4);
    result
}

fn is_known_role(role: &str) -> bool {
    matches!(role, ROLE_SERVER | ROLE_BARISTA | ROLE_GREETER | ROLE_ENTERTAINER)
}

fn normalize_staffing(mut staffing: StaffingState) -> StaffingState {
    staffing.shifts.morning.role_priority =
        normalize_role_priority(staffing.shifts.morning.role_priority, SHIFT_MORNING);
    staffing.shifts.peak.role_priority =
        normalize_role_priority(staffing.shifts.peak.role_priority, SHIFT_PEAK);
    staffing.shifts.evening.role_priority =
        normalize_role_priority(staffing.shifts.evening.role_priority, SHIFT_EVENING);

    staffing.auto_rest.stamina_threshold = clamp(staffing.auto_rest.stamina_threshold, 10.0, 80.0);
    staffing.auto_rest.mood_threshold = clamp(staffing.auto_rest.mood_threshold, 10.0, 80.0);
    staffing.auto_rest.fatigue_threshold = clamp(staffing.auto_rest.fatigue_threshold, 20.0, 95.0);

    if let Some(boost) = staffing.active_boost.as_mut() {
        if boost.source.trim().is_empty() {
            boost.source = "临时调度".to_string();
        }
        boost.remaining_minutes = clamp(boost.remaining_minutes, 0.0, 240.0);
        boost.spawn_rate_multiplier = clamp(boost.spawn_rate_multiplier, 0.7, 1.6);
        boost.service_efficiency_multiplier = clamp(boost.service_efficiency_multiplier, 0.7, 1.6);
        boost.satisfaction_bonus = clamp(boost.satisfaction_bonus, -20.0, 20.0);
    }

    staffing
}

fn normalize_maid_state(mut maid: MaidState) -> MaidState {
    maid.mood = clamp(maid.mood, 0.0, 100.0);
    maid.stamina = clamp(maid.stamina, 0.0, 100.0);
    maid.fatigue = clamp(maid.fatigue, 0.0, 100.0);
    maid.preferred_shift = sanitize_shift(&maid.preferred_shift).to_string();
    maid.skills.service = clamp(maid.skills.service, 0.0, 10.0);
    maid.skills.guest_care = clamp(maid.skills.guest_care, 0.0, 10.0);
    maid.skills.emergency = clamp(maid.skills.emergency, 0.0, 10.0);
    maid
}

fn normalize_customer_state(mut customer: CustomerState) -> CustomerState {
    if customer.customer_type.is_empty() {
        customer.customer_type = "regular".to_string();
    }
    if customer.status.is_empty() {
        customer.status = "seated".to_string();
    }
    customer.patience = clamp(customer.patience, 0.0, 100.0);
    customer.order.total_price = customer.order.total_price.max(0.0);
    customer.service_progress = customer
        .service_progress
        .map(|value| clamp(value, 0.0, 100.0));
    customer
}

fn normalize_customer_status_ticks(input: HashMap<String, u32>) -> HashMap<String, u32> {
    input
        .into_iter()
        .filter_map(|(customer_id, tick)| {
            if customer_id.trim().is_empty() {
                return None;
            }
            let clamped_tick = tick.clamp(1, 8);
            Some((customer_id, clamped_tick))
        })
        .collect()
}

fn parse_seat_number(seat_id: &str) -> Option<u32> {
    let value = seat_id.trim();
    let suffix = value.strip_prefix("seat-")?;
    let parsed = suffix.parse::<u32>().ok()?;
    if parsed == 0 {
        return None;
    }
    Some(parsed)
}

fn normalize_occupied_seat_ids(input: Vec<String>, max_seats: u32) -> Vec<String> {
    let mut normalized_numbers: Vec<u32> = input
        .into_iter()
        .filter_map(|seat_id| parse_seat_number(&seat_id))
        .filter(|seat_number| *seat_number <= max_seats)
        .collect();
    normalized_numbers.sort_unstable();
    normalized_numbers.dedup();
    normalized_numbers
        .into_iter()
        .map(|seat_number| format!("seat-{seat_number}"))
        .collect()
}

fn build_available_seat_ids(max_seats: u32, occupied_seat_ids: &[String]) -> Vec<String> {
    let occupied = occupied_seat_ids
        .iter()
        .filter_map(|seat_id| parse_seat_number(seat_id))
        .collect::<std::collections::HashSet<_>>();
    (1..=max_seats)
        .filter(|seat_number| !occupied.contains(seat_number))
        .map(|seat_number| format!("seat-{seat_number}"))
        .collect()
}

fn normalize_incident_state(mut incident: IncidentState) -> IncidentState {
    incident.remaining_minutes = clamp(incident.remaining_minutes, 0.0, 240.0);
    incident
}

fn tick_staffing_boost(staffing: &mut StaffingState, delta_minutes: f64) {
    let should_clear = if let Some(boost) = staffing.active_boost.as_mut() {
        boost.remaining_minutes -= delta_minutes;
        boost.remaining_minutes <= 0.0
    } else {
        false
    };

    if should_clear {
        staffing.active_boost = None;
    }
}

fn apply_maid_tick(
    maid: &mut MaidState,
    staffing: &StaffingState,
    delta_minutes: f64,
    now_ms: u64,
    seq: &mut u64,
    notifications: &mut Vec<NotificationState>,
) {
    let was_resting = maid.status.is_resting;

    if maid.status.is_resting {
        maid.stamina += delta_minutes * 2.0;
    } else if maid.status.is_working {
        maid.stamina -= delta_minutes * 0.5;
    } else {
        maid.stamina += delta_minutes * 0.5;
    }
    maid.stamina = clamp(maid.stamina, 0.0, 100.0);

    if maid.status.is_resting {
        maid.mood += delta_minutes * 1.0;
    } else if maid.status.is_working {
        maid.mood -= delta_minutes * 0.2;
    } else {
        maid.mood += delta_minutes * 0.5;
    }
    maid.mood = clamp(maid.mood, 0.0, 100.0);

    let boost_load = staffing
        .active_boost
        .as_ref()
        .map(|boost| (boost.service_efficiency_multiplier - 1.0).max(0.0) * 0.9)
        .unwrap_or(0.0);

    if maid.status.is_resting {
        maid.fatigue -= delta_minutes * 0.95;
    } else if maid.status.is_working {
        let streak_load = f64::from(maid.consecutive_work_days) * 0.06;
        maid.fatigue += delta_minutes * (0.42 + streak_load + boost_load);
    } else {
        maid.fatigue -= delta_minutes * 0.25;
    }
    maid.fatigue = clamp(maid.fatigue, 0.0, 100.0);

    apply_auto_rest_policy(maid, staffing);

    if maid.stamina <= 0.0 && !maid.status.is_resting {
        maid.stamina = 0.0;
        maid.status.is_working = false;
        maid.status.is_resting = true;
        maid.status.current_task = None;
        maid.status.serving_customer_id = None;
        notifications.push(NotificationState {
            id: format!("maid_exhausted_{}_{}", maid.id, now_ms + *seq),
            kind: "warning".to_string(),
            message: format!("{} 体力耗尽，已自动安排休息", maid.name),
            timestamp: now_ms + *seq,
        });
        *seq += 1;
    } else if !was_resting && maid.status.is_resting {
        notifications.push(NotificationState {
            id: format!("maid_auto_rest_{}_{}", maid.id, now_ms + *seq),
            kind: "info".to_string(),
            message: format!("{} 触发自动轮休", maid.name),
            timestamp: now_ms + *seq,
        });
        *seq += 1;
    } else if was_resting && !maid.status.is_resting {
        notifications.push(NotificationState {
            id: format!("maid_auto_resume_{}_{}", maid.id, now_ms + *seq),
            kind: "success".to_string(),
            message: format!("{} 状态恢复，已可重新排班", maid.name),
            timestamp: now_ms + *seq,
        });
        *seq += 1;
    }
}

fn apply_auto_rest_policy(maid: &mut MaidState, staffing: &StaffingState) {
    let config = &staffing.auto_rest;
    if !config.enabled {
        return;
    }

    let need_rest = maid.stamina <= config.stamina_threshold
        || maid.mood <= config.mood_threshold
        || maid.fatigue >= config.fatigue_threshold;

    if !maid.status.is_resting && need_rest {
        maid.status.is_resting = true;
        maid.status.is_working = false;
        maid.status.current_task = None;
        maid.status.serving_customer_id = None;
        return;
    }

    let ready_to_return = maid.stamina >= config.stamina_threshold + 25.0
        && maid.mood >= config.mood_threshold + 18.0
        && maid.fatigue <= config.fatigue_threshold - 18.0;

    if maid.status.is_resting && ready_to_return {
        maid.status.is_resting = false;
    }
}

fn tick_active_incident(
    active_incident: &mut Option<IncidentState>,
    delta_minutes: f64,
    now_ms: u64,
    seq: &mut u64,
    notifications: &mut Vec<NotificationState>,
) {
    let should_clear = if let Some(incident) = active_incident.as_mut() {
        incident.remaining_minutes -= delta_minutes;
        if incident.remaining_minutes <= 0.0 {
            notifications.push(NotificationState {
                id: format!("incident_expired_{}_{}", incident.id, now_ms + *seq),
                kind: "info".to_string(),
                message: format!("{} {} 已结束", incident.icon, incident.title),
                timestamp: now_ms + *seq,
            });
            *seq += 1;
            true
        } else {
            false
        }
    } else {
        false
    };

    if should_clear {
        *active_incident = None;
    }
}

fn build_native_frame(
    maids: &[MaidState],
    customers: &[CustomerState],
    menu_items: &[MenuItemState],
    staffing: &StaffingState,
    reputation: f64,
    season: &str,
    customer_spawn_ms: f64,
    customer_status_ticks: &HashMap<String, u32>,
    customer_streak: u32,
    occupied_seat_ids: &[String],
    max_seats: u32,
    occupied_seat_count: u32,
    day: u32,
    shift: &str,
    waiting_count: u32,
    delta_minutes: f64,
    now_ms: u64,
    base_spawn_interval_ms: f64,
) -> NativeStaffingFrame {
    let shift_cfg = shift_config(staffing, shift);
    let spawn_interval_ms = calculate_spawn_interval(base_spawn_interval_ms, day, shift, staffing);
    let mut maid_profiles: HashMap<String, NativeMaidProfile> = HashMap::new();
    let mut customer_profiles: HashMap<String, NativeCustomerProfile> = HashMap::new();
    let mut service_outcomes: HashMap<String, NativeServiceOutcomeProfile> = HashMap::new();
    let mut service_progress_updates: HashMap<String, NativeServiceProgressUpdate> = HashMap::new();
    let mut service_metrics = NativeServiceMetrics::default();
    let combo_multiplier = calculate_combo_multiplier(customer_streak);
    let combo_reputation_bonus = calculate_combo_reputation_bonus(customer_streak);
    let (next_customer_status_ticks, customer_status_updates, removed_customer_ids) =
        simulate_customer_status_flow(customers, customer_status_ticks);
    let spawn_plan = calculate_spawn_plan(
        customer_spawn_ms,
        f64::from(spawn_interval_ms),
        max_seats,
        occupied_seat_count,
    );
    let available_seat_ids = build_available_seat_ids(max_seats, occupied_seat_ids);
    let spawn_candidates = generate_spawn_candidates(
        reputation,
        season,
        menu_items,
        now_ms,
        &available_seat_ids,
        spawn_plan.spawn_count as usize,
    );

    for maid in maids {
        let role_allowed = is_role_allowed_for_shift(
            &maid.role,
            &shift_cfg.role_priority,
            shift_cfg.allow_cross_role,
        );

        let service_progress_multiplier =
            calculate_service_progress_multiplier(maid, shift, waiting_count, staffing);
        let base_service_progress_delta = calculate_base_service_progress_delta(maid, delta_minutes);
        let satisfaction_bonus = calculate_satisfaction_bonus(maid, staffing);
        let service_score =
            calculate_service_score(maid, shift, waiting_count, &shift_cfg.role_priority, staffing);

        maid_profiles.insert(
            maid.id.clone(),
            NativeMaidProfile {
                base_service_progress_delta,
                service_progress_multiplier,
                satisfaction_bonus,
                service_score,
                role_allowed,
            },
        );
    }

    for customer in customers {
        let (next_patience, should_leave, reputation_penalty) =
            simulate_customer_patience(customer, delta_minutes);
        customer_profiles.insert(
            customer.id.clone(),
            NativeCustomerProfile {
                next_patience,
                should_leave,
                reputation_penalty,
            },
        );

        let Some(maid_id) = customer.serving_maid_id.as_deref() else {
            continue;
        };
        if customer.status != STATUS_WAITING_ORDER {
            continue;
        }
        let Some(maid) = maids.iter().find(|item| item.id == maid_id) else {
            continue;
        };

        let current_progress = customer.service_progress.unwrap_or(0.0);
        let maid_profile = maid_profiles.get(maid_id);
        let base_service_progress_delta = maid_profile
            .map(|profile| profile.base_service_progress_delta)
            .unwrap_or_else(|| calculate_base_service_progress_delta(maid, delta_minutes));
        let service_progress_multiplier = maid_profile
            .map(|profile| profile.service_progress_multiplier)
            .unwrap_or_else(|| {
                calculate_service_progress_multiplier(maid, shift, waiting_count, staffing)
            });
        let next_progress = clamp(
            current_progress + (base_service_progress_delta * service_progress_multiplier),
            0.0,
            100.0,
        );
        service_progress_updates.insert(
            customer.id.clone(),
            NativeServiceProgressUpdate {
                next_progress,
                completed: next_progress >= 100.0,
            },
        );

        let wait_time_minutes = customer
            .service_start_time
            .map(|started| now_ms.saturating_sub(started) as f64 / 60000.0)
            .unwrap_or(0.0);
        let base_satisfaction = calculate_base_satisfaction(maid, customer, wait_time_minutes);
        let satisfaction_bonus = calculate_satisfaction_bonus(maid, staffing);
        let final_satisfaction = clamp(base_satisfaction + satisfaction_bonus, 0.0, 100.0);
        let (base_gold, base_tip, base_reputation, maid_experience) =
            calculate_rewards_from_satisfaction(customer, maid, final_satisfaction);
        let gold = (base_gold * combo_multiplier).round().max(0.0);
        let tip_multiplier = 1.0 + ((combo_multiplier - 1.0) * 1.5);
        let tip = (base_tip * tip_multiplier).round().max(0.0);
        let reputation = base_reputation + combo_reputation_bonus;
        if next_progress >= 100.0 {
            service_metrics.completed_count = service_metrics.completed_count.saturating_add(1);
            if customer.customer_type == "vip" {
                service_metrics.completed_vip_count =
                    service_metrics.completed_vip_count.saturating_add(1);
            }
            service_metrics.gold_total += gold;
            service_metrics.tip_total += tip;
            service_metrics.reputation_total += reputation;
            service_metrics.max_satisfaction =
                service_metrics.max_satisfaction.max(final_satisfaction);
        }

        service_outcomes.insert(
            customer.id.clone(),
            NativeServiceOutcomeProfile {
                satisfaction: final_satisfaction,
                gold,
                tip,
                reputation,
                maid_experience,
                combo_multiplier,
            },
        );
    }

    let service_assignments = build_service_assignments(maids, customers, &maid_profiles);

    NativeStaffingFrame {
        shift: shift.to_string(),
        waiting_count,
        spawn_interval_ms,
        maid_profiles,
        customer_profiles,
        service_outcomes,
        service_progress_updates,
        service_metrics,
        customer_status_ticks: next_customer_status_ticks,
        customer_status_updates,
        removed_customer_ids,
        service_assignments,
        spawn_plan,
        spawn_candidates,
    }
}

fn shift_config(staffing: &StaffingState, shift: &str) -> StaffingShiftConfig {
    match shift {
        SHIFT_MORNING => staffing.shifts.morning.clone(),
        SHIFT_EVENING => staffing.shifts.evening.clone(),
        _ => staffing.shifts.peak.clone(),
    }
}

fn calculate_spawn_interval(
    base_interval_ms: f64,
    day: u32,
    shift: &str,
    staffing: &StaffingState,
) -> u32 {
    let day_pressure = (f64::from(day.saturating_sub(1)) * 0.018).min(0.42);
    let shift_pressure = if shift == SHIFT_PEAK {
        0.18
    } else if shift == SHIFT_EVENING {
        0.09
    } else {
        0.03
    };
    let difficulty_multiplier = 1.0 + day_pressure + shift_pressure;
    let boost_multiplier = staffing
        .active_boost
        .as_ref()
        .map(|boost| boost.spawn_rate_multiplier)
        .unwrap_or(1.0);

    let adjusted = base_interval_ms / (difficulty_multiplier * boost_multiplier);
    clamp(adjusted.round(), 7000.0, 60000.0) as u32
}

fn calculate_service_progress_multiplier(
    maid: &MaidState,
    shift: &str,
    waiting_count: u32,
    staffing: &StaffingState,
) -> f64 {
    let waiting_pressure = (f64::from(waiting_count) * 0.02).min(0.25);
    let shift_bonus = if maid.preferred_shift == shift { 0.08 } else { -0.04 };
    let service_skill_bonus = maid.skills.service * 0.06;
    let emergency_skill_bonus = if shift == SHIFT_PEAK || waiting_count >= 3 {
        maid.skills.emergency * 0.05
    } else {
        maid.skills.emergency * 0.02
    };
    let fatigue_penalty = maid.fatigue * 0.0035;
    let streak_penalty = f64::from(maid.consecutive_work_days) * 0.02;
    let boost_multiplier = staffing
        .active_boost
        .as_ref()
        .map(|boost| boost.service_efficiency_multiplier)
        .unwrap_or(1.0);

    let multiplier = 1.0 + waiting_pressure + shift_bonus + service_skill_bonus + emergency_skill_bonus
        - fatigue_penalty
        - streak_penalty;

    clamp(multiplier * boost_multiplier, 0.6, 1.8)
}

fn calculate_base_service_progress_delta(maid: &MaidState, delta_minutes: f64) -> f64 {
    let speed = clamp(maid.stats.speed, 0.0, 100.0);
    let progress_increment = speed * 0.5 * delta_minutes;
    let stamina_multiplier = if maid.stamina < 50.0 { 0.7 } else { 1.0 };
    (progress_increment * stamina_multiplier).max(0.0)
}

fn calculate_satisfaction_bonus(maid: &MaidState, staffing: &StaffingState) -> f64 {
    let guest_care_bonus = maid.skills.guest_care * 2.0;
    let boost_bonus = staffing
        .active_boost
        .as_ref()
        .map(|boost| boost.satisfaction_bonus)
        .unwrap_or(0.0);
    let fatigue_penalty = if maid.fatigue >= 80.0 {
        6.0
    } else if maid.fatigue >= 60.0 {
        3.0
    } else {
        0.0
    };
    (guest_care_bonus + boost_bonus - fatigue_penalty).round()
}

fn calculate_service_score(
    maid: &MaidState,
    shift: &str,
    waiting_count: u32,
    role_priority: &[String],
    staffing: &StaffingState,
) -> f64 {
    let base_efficiency = calculate_efficiency(maid);
    let role_weight = f64::from(get_role_priority_weight(&maid.role, role_priority)) * 14.0;
    let shift_match = if maid.preferred_shift == shift { 10.0 } else { -4.0 };
    let emergency_weight = if shift == SHIFT_PEAK || waiting_count >= 3 {
        maid.skills.emergency * 5.0
    } else {
        maid.skills.emergency * 2.0
    };
    let skill_weight = maid.skills.service * 5.0 + maid.skills.guest_care * 2.0 + emergency_weight;
    let fatigue_penalty = maid.fatigue * 1.1;
    let streak_penalty = f64::from(maid.consecutive_work_days) * 2.5;
    let boost = staffing
        .active_boost
        .as_ref()
        .map(|item| item.service_efficiency_multiplier)
        .unwrap_or(1.0);

    (base_efficiency * boost) + role_weight + shift_match + skill_weight - fatigue_penalty - streak_penalty
}

fn calculate_efficiency(maid: &MaidState) -> f64 {
    let charm = clamp(maid.stats.charm, 0.0, 100.0);
    let skill = clamp(maid.stats.skill, 0.0, 100.0);
    let speed = clamp(maid.stats.speed, 0.0, 100.0);
    let mood = clamp(maid.mood, 0.0, 100.0);
    let fatigue = clamp(maid.fatigue, 0.0, 100.0);

    let base_efficiency = (charm + skill + speed) / 3.0;
    let mood_modifier = 0.5 + (mood / 200.0);
    let mut efficiency = base_efficiency * mood_modifier;
    let skill_bonus = 1.0 + clamp(maid.skills.service * 0.03, 0.0, 0.3);
    let fatigue_penalty = 1.0 - (fatigue / 180.0);
    efficiency = efficiency * skill_bonus * fatigue_penalty;

    if maid.stamina < 20.0 {
        efficiency *= 0.5;
    }

    clamp(efficiency, 0.0, 100.0)
}

fn get_role_priority_weight(role: &str, role_priority: &[String]) -> u32 {
    match role_priority.iter().position(|item| item == role) {
        Some(index) => {
            let idx = index as u32;
            if idx >= 4 {
                0
            } else {
                4 - idx
            }
        }
        None => 0,
    }
}

fn is_role_allowed_for_shift(role: &str, role_priority: &[String], allow_cross_role: bool) -> bool {
    if allow_cross_role {
        return true;
    }

    role_priority.iter().take(2).any(|item| item == role)
}

fn calculate_base_satisfaction(maid: &MaidState, customer: &CustomerState, wait_time: f64) -> f64 {
    let mut satisfaction = 50.0;
    let charm_bonus = (clamp(maid.stats.charm, 0.0, 100.0) / 100.0) * 25.0;
    let skill_bonus = (clamp(maid.stats.skill, 0.0, 100.0) / 100.0) * 25.0;
    satisfaction += charm_bonus + skill_bonus;

    let wait_penalty = (wait_time / 5.0).floor().min(30.0);
    satisfaction -= wait_penalty;

    satisfaction = match customer.customer_type.as_str() {
        "vip" => (satisfaction * 1.2) - 10.0,
        "critic" => satisfaction * 0.9,
        "group" => satisfaction * 1.1,
        _ => satisfaction,
    };

    if maid.stamina < 50.0 {
        let stamina_penalty = ((50.0 - maid.stamina) / 50.0) * 10.0;
        satisfaction -= stamina_penalty;
    }
    if maid.mood < 50.0 {
        let mood_penalty = ((50.0 - maid.mood) / 50.0) * 10.0;
        satisfaction -= mood_penalty;
    }

    clamp(satisfaction.round(), 0.0, 100.0)
}

fn calculate_tip(satisfaction: f64, maid_charm: f64) -> f64 {
    if satisfaction < 50.0 {
        return 0.0;
    }
    let base_tip = (satisfaction - 50.0) * 0.5;
    let charm_multiplier = 1.0 + (maid_charm / 100.0) * 0.5;
    (base_tip * charm_multiplier).round().max(0.0)
}

fn calculate_rewards_from_satisfaction(
    customer: &CustomerState,
    maid: &MaidState,
    satisfaction: f64,
) -> (f64, f64, f64, f64) {
    let mut gold = customer.order.total_price.max(0.0);
    let tip = calculate_tip(satisfaction, clamp(maid.stats.charm, 1.0, 100.0));

    let reputation = if satisfaction >= 80.0 {
        match customer.customer_type.as_str() {
            "vip" => 3.0,
            "critic" => 5.0,
            _ => 1.0,
        }
    } else if satisfaction >= 60.0 {
        if customer.customer_type == "critic" {
            2.0
        } else {
            0.0
        }
    } else if satisfaction < 40.0 {
        match customer.customer_type.as_str() {
            "critic" => -5.0,
            "vip" => -3.0,
            _ => -1.0,
        }
    } else {
        0.0
    };

    if customer.customer_type == "vip" && satisfaction >= 70.0 {
        gold = (gold * 1.2).round().max(1.0);
    }

    let maid_experience = (5.0 + (satisfaction / 100.0) * 20.0).round();

    (gold, tip, reputation, maid_experience)
}

fn simulate_customer_patience(customer: &CustomerState, delta_minutes: f64) -> (f64, bool, u32) {
    let mut patience_decay = match customer.status.as_str() {
        "waiting_seat" => delta_minutes * 2.0,
        "waiting_order" => delta_minutes * 0.8,
        "ordering" | "seated" => delta_minutes * 0.5,
        "eating" | "paying" | "leaving" => 0.0,
        _ => delta_minutes,
    };

    patience_decay *= match customer.customer_type.as_str() {
        "vip" => 1.3,
        "critic" => 1.5,
        "group" => 0.8,
        _ => 1.0,
    };

    let next_patience = clamp(customer.patience - patience_decay, 0.0, 100.0);
    let should_leave = next_patience <= 0.0
        && customer.status != "leaving"
        && customer.status != "paying";

    let reputation_penalty = if should_leave {
        match customer.customer_type.as_str() {
            "vip" => 5,
            "critic" => 8,
            "group" => 4,
            _ => 2,
        }
    } else {
        0
    };

    (next_patience, should_leave, reputation_penalty)
}

fn calculate_combo_multiplier(customer_streak: u32) -> f64 {
    match customer_streak {
        0..=2 => 1.0,
        3..=5 => 1.06,
        6..=9 => 1.12,
        10..=14 => 1.2,
        _ => 1.28,
    }
}

fn calculate_combo_reputation_bonus(customer_streak: u32) -> f64 {
    if customer_streak >= 10 {
        1.0
    } else if customer_streak >= 6 {
        0.5
    } else if customer_streak >= 3 {
        0.2
    } else {
        0.0
    }
}

fn simulate_customer_status_flow(
    customers: &[CustomerState],
    customer_status_ticks: &HashMap<String, u32>,
) -> (HashMap<String, u32>, HashMap<String, String>, Vec<String>) {
    let mut next_ticks: HashMap<String, u32> = HashMap::new();
    let mut status_updates: HashMap<String, String> = HashMap::new();
    let mut removed_customer_ids: Vec<String> = Vec::new();

    for customer in customers {
        let status = customer.status.as_str();
        if status != STATUS_EATING && status != STATUS_PAYING && status != STATUS_LEAVING {
            continue;
        }

        let default_ticks = if status == STATUS_EATING { 2 } else { 1 };
        let current_tick = customer_status_ticks
            .get(&customer.id)
            .copied()
            .unwrap_or(default_ticks)
            .clamp(1, 8);
        let remaining_tick = current_tick.saturating_sub(1);

        if remaining_tick > 0 {
            next_ticks.insert(customer.id.clone(), remaining_tick);
            continue;
        }

        if status == STATUS_EATING {
            status_updates.insert(customer.id.clone(), STATUS_PAYING.to_string());
            next_ticks.insert(customer.id.clone(), 1);
            continue;
        }

        if status == STATUS_PAYING {
            status_updates.insert(customer.id.clone(), STATUS_LEAVING.to_string());
            next_ticks.insert(customer.id.clone(), 1);
            continue;
        }

        removed_customer_ids.push(customer.id.clone());
    }

    (next_ticks, status_updates, removed_customer_ids)
}

fn build_service_assignments(
    maids: &[MaidState],
    customers: &[CustomerState],
    maid_profiles: &HashMap<String, NativeMaidProfile>,
) -> Vec<NativeServiceAssignment> {
    let mut available_maid_ids = maids
        .iter()
        .filter(|maid| {
            !maid.status.is_resting
                && !maid.status.is_working
                && maid.status.serving_customer_id.is_none()
                && maid.stamina >= 10.0
        })
        .map(|maid| maid.id.clone())
        .filter(|maid_id| maid_profiles.get(maid_id).map(|profile| profile.role_allowed).unwrap_or(true))
        .collect::<Vec<_>>();

    available_maid_ids.sort_by(|a, b| {
        let score_a = maid_profiles
            .get(a)
            .map(|profile| profile.service_score)
            .unwrap_or(f64::NEG_INFINITY);
        let score_b = maid_profiles
            .get(b)
            .map(|profile| profile.service_score)
            .unwrap_or(f64::NEG_INFINITY);
        match score_b
            .partial_cmp(&score_a)
            .unwrap_or(std::cmp::Ordering::Equal)
        {
            std::cmp::Ordering::Equal => a.cmp(b),
            order => order,
        }
    });

    let mut waiting_customers = customers
        .iter()
        .filter(|customer| customer.status == STATUS_SEATED)
        .map(|customer| (customer.id.clone(), customer.patience))
        .collect::<Vec<_>>();
    waiting_customers.sort_by(|a, b| {
        match a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal) {
            std::cmp::Ordering::Equal => a.0.cmp(&b.0),
            order => order,
        }
    });

    let assign_count = available_maid_ids.len().min(waiting_customers.len());
    let mut assignments = Vec::with_capacity(assign_count);
    for index in 0..assign_count {
        assignments.push(NativeServiceAssignment {
            maid_id: available_maid_ids[index].clone(),
            customer_id: waiting_customers[index].0.clone(),
        });
    }
    assignments
}

fn calculate_spawn_plan(
    customer_spawn_ms: f64,
    spawn_interval_ms: f64,
    max_seats: u32,
    occupied_seat_count: u32,
) -> NativeSpawnPlan {
    let mut spawn_ms = customer_spawn_ms.max(0.0);
    let interval = spawn_interval_ms.max(1.0);
    let mut spawn_count = 0_u32;
    let mut occupied = occupied_seat_count.min(max_seats);

    while spawn_ms >= interval && spawn_count < SPAWN_CANDIDATE_MAX as u32 && occupied < max_seats {
        spawn_ms -= interval;
        spawn_count += 1;
        occupied += 1;
    }

    NativeSpawnPlan {
        spawn_count,
        next_spawn_ms: spawn_ms.max(0.0),
    }
}

fn generate_spawn_candidates(
    reputation: f64,
    season: &str,
    menu_items: &[MenuItemState],
    now_ms: u64,
    available_seat_ids: &[String],
    max_count: usize,
) -> Vec<NativeSpawnCandidate> {
    let mut rng = rand::thread_rng();
    let planned_count = max_count.min(available_seat_ids.len());
    let mut candidates: Vec<NativeSpawnCandidate> = Vec::with_capacity(planned_count);

    for index in 0..planned_count {
        let customer_type = select_customer_type(reputation, &mut rng);
        let (min_patience, max_patience) = match customer_type {
            "vip" => (50_u32, 90_u32),
            "critic" => (40_u32, 80_u32),
            "group" => (80_u32, 100_u32),
            _ => (70_u32, 100_u32),
        };

        let patience = f64::from(rng.gen_range(min_patience..=max_patience));
        let first_name = CUSTOMER_FIRST_NAMES[rng.gen_range(0..CUSTOMER_FIRST_NAMES.len())];
        let last_name = CUSTOMER_LAST_NAMES[rng.gen_range(0..CUSTOMER_LAST_NAMES.len())];
        let avatar = CUSTOMER_AVATARS[rng.gen_range(0..CUSTOMER_AVATARS.len())];
        let order = generate_order_for_spawn(customer_type, season, menu_items, &mut rng);

        candidates.push(NativeSpawnCandidate {
            id: format!("customer_{}_{}", now_ms + index as u64, rng.gen::<u32>()),
            customer_type: customer_type.to_string(),
            name: format!("{last_name}{first_name}"),
            avatar: avatar.to_string(),
            patience,
            satisfaction: 50.0,
            arrival_time: now_ms,
            seat_id: available_seat_ids[index].clone(),
            order,
        });
    }

    candidates
}

fn select_customer_type(reputation: f64, rng: &mut impl Rng) -> &'static str {
    let clamped_reputation = clamp(reputation, 0.0, 100.0);
    let regular_weight = 70.0;
    let vip_weight = 15.0 + (clamped_reputation / 100.0) * 0.2 * 100.0;
    let critic_weight = 10.0 + (clamped_reputation / 100.0) * 0.1 * 100.0;
    let group_weight = 5.0 + (clamped_reputation / 100.0) * 0.15 * 100.0;
    let total = regular_weight + vip_weight + critic_weight + group_weight;

    let mut random = rng.gen::<f64>() * total;
    random -= regular_weight;
    if random <= 0.0 {
        return "regular";
    }
    random -= vip_weight;
    if random <= 0.0 {
        return "vip";
    }
    random -= critic_weight;
    if random <= 0.0 {
        return "critic";
    }
    "group"
}

fn generate_order_for_spawn(
    customer_type: &str,
    season: &str,
    menu_items: &[MenuItemState],
    rng: &mut impl Rng,
) -> NativeOrder {
    let available_items = menu_items
        .iter()
        .filter(|item| {
            if !item.unlocked {
                return false;
            }
            match item.season.as_deref() {
                None => true,
                Some(item_season) => item_season == season,
            }
        })
        .collect::<Vec<_>>();

    if available_items.is_empty() {
        return NativeOrder::default();
    }

    let (min_count, max_count) = match customer_type {
        "vip" => (2_usize, 4_usize),
        "group" => (3_usize, 6_usize),
        "critic" => (1_usize, 3_usize),
        _ => (1_usize, 3_usize),
    };

    let order_count = rng.gen_range(min_count..=max_count.min(available_items.len()));
    let total_weight = available_items
        .iter()
        .map(|item| 10.0 + item.popularity)
        .sum::<f64>();

    let mut selected_items: Vec<NativeOrderItem> = Vec::new();
    let mut selected_ids: Vec<&str> = Vec::new();
    let max_attempts = order_count * 2;
    let mut attempts = 0_usize;

    while selected_items.len() < order_count && attempts < max_attempts {
        attempts += 1;
        let mut random = rng.gen::<f64>() * total_weight;

        for item in &available_items {
            random -= 10.0 + item.popularity;
            if random <= 0.0 && !selected_ids.iter().any(|id| *id == item.id.as_str()) {
                selected_ids.push(item.id.as_str());
                selected_items.push(NativeOrderItem {
                    menu_item_id: item.id.clone(),
                    quantity: if customer_type == "group" {
                        rng.gen_range(1..=3)
                    } else {
                        1
                    },
                    prepared: false,
                });
                break;
            }
        }
    }

    let total_price = selected_items
        .iter()
        .map(|order_item| {
            let price = available_items
                .iter()
                .find(|item| item.id == order_item.menu_item_id)
                .map(|item| item.current_price)
                .unwrap_or(0.0);
            price * f64::from(order_item.quantity)
        })
        .sum::<f64>();

    NativeOrder {
        items: selected_items,
        total_price,
        prepared_items: Vec::new(),
    }
}

fn roll_operational_incident(
    day: u32,
    shift: &str,
    waiting_count: u32,
    now_ms: u64,
) -> Option<IncidentState> {
    if day < 6 {
        return None;
    }

    let base_chance = 0.004 + (f64::from(day.saturating_sub(5)) * 0.00035).min(0.012);
    let shift_bonus = if shift == SHIFT_PEAK { 0.003 } else { 0.0 };
    let waiting_bonus = (f64::from(waiting_count) * 0.0009).min(0.01);
    let final_chance = base_chance + shift_bonus + waiting_bonus;

    let mut rng = rand::thread_rng();
    if rng.gen::<f64>() > final_chance {
        return None;
    }

    let templates = incident_templates();
    if templates.is_empty() {
        return None;
    }
    let index = rng.gen_range(0..templates.len());
    let template = &templates[index];
    let suffix: u16 = rng.gen();
    Some(IncidentState {
        id: format!("{}-{}-{:04x}", template.id, now_ms, suffix),
        icon: template.icon.to_string(),
        title: template.title.to_string(),
        description: template.description.to_string(),
        remaining_minutes: template.duration_minutes,
        options: template.options.clone(),
    })
}

fn incident_templates() -> Vec<IncidentTemplate> {
    vec![
        IncidentTemplate {
            id: "rush-order",
            icon: "🚨",
            title: "突发团客订单",
            description: "附近活动散场，短时间内出现密集客流，需要立即调整策略。",
            duration_minutes: 60.0,
            options: vec![
                IncidentOption {
                    id: "rush-order-stabilize".to_string(),
                    label: "稳态接待".to_string(),
                    description: "优先稳定服务质量，减少排队流失。".to_string(),
                    reputation_delta: Some(2.0),
                    gold_delta: None,
                    mood_delta: Some(-4.0),
                    fatigue_delta: Some(6.0),
                    spawn_rate_multiplier: Some(1.05),
                    service_efficiency_multiplier: Some(1.1),
                    satisfaction_bonus: Some(4.0),
                    duration_minutes: Some(50.0),
                },
                IncidentOption {
                    id: "rush-order-push".to_string(),
                    label: "冲刺接单".to_string(),
                    description: "短时拉高吞吐，风险是员工压力和评价波动。".to_string(),
                    reputation_delta: Some(-1.0),
                    gold_delta: Some(180.0),
                    mood_delta: Some(-8.0),
                    fatigue_delta: Some(12.0),
                    spawn_rate_multiplier: Some(1.2),
                    service_efficiency_multiplier: Some(1.15),
                    satisfaction_bonus: Some(-2.0),
                    duration_minutes: Some(45.0),
                },
                IncidentOption {
                    id: "rush-order-conservative".to_string(),
                    label: "限流保守".to_string(),
                    description: "主动降载，减少损耗但会损失部分收入。".to_string(),
                    reputation_delta: Some(1.0),
                    gold_delta: Some(-120.0),
                    mood_delta: Some(2.0),
                    fatigue_delta: Some(-4.0),
                    spawn_rate_multiplier: Some(0.85),
                    service_efficiency_multiplier: Some(1.05),
                    satisfaction_bonus: Some(6.0),
                    duration_minutes: Some(40.0),
                },
            ],
        },
        IncidentTemplate {
            id: "equipment-warning",
            icon: "🛠️",
            title: "设备预警",
            description: "关键设备出现异常，继续满负荷运行可能影响出品稳定性。",
            duration_minutes: 70.0,
            options: vec![
                IncidentOption {
                    id: "equipment-warning-maintain".to_string(),
                    label: "立即保养".to_string(),
                    description: "花钱换稳定，短期收益下降。".to_string(),
                    reputation_delta: Some(1.0),
                    gold_delta: Some(-220.0),
                    mood_delta: Some(1.0),
                    fatigue_delta: Some(-5.0),
                    spawn_rate_multiplier: None,
                    service_efficiency_multiplier: Some(0.95),
                    satisfaction_bonus: Some(5.0),
                    duration_minutes: Some(55.0),
                },
                IncidentOption {
                    id: "equipment-warning-run".to_string(),
                    label: "继续运行".to_string(),
                    description: "维持产出但有波动风险。".to_string(),
                    reputation_delta: Some(-2.0),
                    gold_delta: Some(120.0),
                    mood_delta: Some(-3.0),
                    fatigue_delta: Some(5.0),
                    spawn_rate_multiplier: None,
                    service_efficiency_multiplier: Some(1.05),
                    satisfaction_bonus: Some(-4.0),
                    duration_minutes: Some(50.0),
                },
            ],
        },
        IncidentTemplate {
            id: "vip-wave",
            icon: "🌟",
            title: "VIP 预约高峰",
            description: "高消费客人集中到店，服务节奏需要更精细。",
            duration_minutes: 80.0,
            options: vec![
                IncidentOption {
                    id: "vip-wave-premium".to_string(),
                    label: "高规格接待".to_string(),
                    description: "投入更多精力提升口碑，回报更稳。".to_string(),
                    reputation_delta: Some(3.0),
                    gold_delta: Some(150.0),
                    mood_delta: Some(-6.0),
                    fatigue_delta: Some(8.0),
                    spawn_rate_multiplier: None,
                    service_efficiency_multiplier: Some(1.05),
                    satisfaction_bonus: Some(8.0),
                    duration_minutes: Some(65.0),
                },
                IncidentOption {
                    id: "vip-wave-balanced".to_string(),
                    label: "均衡接待".to_string(),
                    description: "控制成本，保持常规运营节奏。".to_string(),
                    reputation_delta: Some(1.0),
                    gold_delta: Some(80.0),
                    mood_delta: Some(-2.0),
                    fatigue_delta: Some(3.0),
                    spawn_rate_multiplier: Some(1.1),
                    service_efficiency_multiplier: Some(1.0),
                    satisfaction_bonus: Some(2.0),
                    duration_minutes: Some(60.0),
                },
            ],
        },
    ]
}
