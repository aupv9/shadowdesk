import type { TranslationKey } from './en'

const vi: Record<TranslationKey, string> = {
  // App
  'app.name': 'Ghost Browser',
  'app.tagline': 'Nền tảng trình duyệt chống phát hiện',

  // Sidebar
  'nav.profiles': 'Hồ sơ',
  'nav.proxies': 'Proxy',
  'nav.automation': 'Tự động hóa',
  'nav.detection': 'Kiểm tra phát hiện',
  'nav.fingerprint': 'Dấu vân tay',
  'nav.settings': 'Cài đặt',
  'nav.account': 'Tài khoản',
  'nav.team': 'Nhóm',

  // Profiles
  'profiles.title': 'Quản lý hồ sơ',
  'profiles.create': 'Tạo hồ sơ',
  'profiles.edit': 'Sửa hồ sơ',
  'profiles.delete': 'Xóa hồ sơ',
  'profiles.launch': 'Khởi chạy',
  'profiles.close': 'Đóng',
  'profiles.clone': 'Nhân bản',
  'profiles.search': 'Tìm kiếm hồ sơ...',
  'profiles.empty': 'Chưa có hồ sơ. Tạo một hồ sơ để bắt đầu.',
  'profiles.health': 'Điểm sức khỏe',
  'profiles.lastUsed': 'Sử dụng lần cuối',
  'profiles.neverUsed': 'Chưa sử dụng',
  'profiles.group': 'Nhóm',
  'profiles.noGroup': 'Không có nhóm',

  // Proxies
  'proxies.title': 'Quản lý Proxy',
  'proxies.add': 'Thêm Proxy',
  'proxies.test': 'Kiểm tra',
  'proxies.healthy': 'Khỏe mạnh',
  'proxies.unhealthy': 'Không khỏe',
  'proxies.latency': 'Độ trễ',

  // Automation
  'automation.title': 'Trình tạo tự động',
  'automation.create': 'Tạo quy trình',
  'automation.run': 'Chạy',
  'automation.dryRun': 'Chạy thử',
  'automation.stop': 'Dừng',
  'automation.steps': 'Bước',
  'automation.variables': 'Biến',

  // Detection
  'detection.title': 'Bảng điều khiển phát hiện',
  'detection.run': 'Chạy kiểm tra',
  'detection.score': 'Điểm',
  'detection.passed': 'Đạt',
  'detection.failed': 'Không đạt',
  'detection.vectors': 'Vectors',

  // Settings
  'settings.title': 'Cài đặt',
  'settings.language': 'Ngôn ngữ',
  'settings.theme': 'Giao diện',
  'settings.ai': 'Trợ lý AI',
  'settings.apiKey': 'Khóa API',

  // Common
  'common.save': 'Lưu',
  'common.cancel': 'Hủy',
  'common.delete': 'Xóa',
  'common.edit': 'Sửa',
  'common.create': 'Tạo',
  'common.close': 'Đóng',
  'common.loading': 'Đang tải...',
  'common.error': 'Lỗi',
  'common.success': 'Thành công',
  'common.confirm': 'Xác nhận',
  'common.search': 'Tìm kiếm',
  'common.noResults': 'Không tìm thấy kết quả',
  'common.actions': 'Hành động',
  'common.status': 'Trạng thái',
  'common.name': 'Tên',
  'common.type': 'Loại',
  'common.date': 'Ngày',

  // Health Score
  'health.low': 'Rủi ro thấp',
  'health.medium': 'Rủi ro trung bình',
  'health.high': 'Rủi ro cao',
  'health.critical': 'Rủi ro nghiêm trọng',
  'health.detection': 'Phát hiện',
  'health.behavior': 'Hành vi',
  'health.freshness': 'Độ mới',
}

export default vi
