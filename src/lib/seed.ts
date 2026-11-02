import type { Folder, Item, Payload, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  autoLockMinutes: 5,
  clipboardClearSeconds: 30,
  revealSeconds: 8,
  hideOnBlur: true,
  biometric: true,
  autoBackup: false,
};

export const DEFAULT_FOLDERS: Folder[] = [
  { id: 'f-work', name: 'Công việc', color: '#C6F36B' },
  { id: 'f-side', name: 'Dự án cá nhân', color: '#7AB8FF' },
  { id: 'f-study', name: 'Học tập', color: '#4FD6C4' },
  { id: 'f-family', name: 'Gia đình', color: '#FF7A70' },
  { id: 'f-travel', name: 'Du lịch', color: '#F08CE0' },
];

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const ahead = (hours: number) => new Date(now + hours * 3_600_000).toISOString();

let n = 0;
const id = () => `seed-${++n}`;

type Draft = Partial<Item> & Pick<Item, 'kind' | 'title'>;

function item(d: Draft): Item {
  return {
    id: id(),
    body: '',
    folderId: null,
    labels: [],
    username: '',
    secret: '',
    totp: '',
    url: '',
    secureNote: '',
    todos: [],
    pinned: false,
    starred: false,
    remindAt: null,
    createdAt: ago(60 * 24 * 30),
    updatedAt: ago(60),
    ...d,
  };
}

const todo = (text: string, done = false) => ({ id: id(), text, done });

export const SEED_ITEMS: Item[] = [
  item({
    kind: 'note',
    title: 'Quy trình phát hành bản mới',
    body: 'Các bước cần làm mỗi lần phát hành. Kiểm tra lần lượt, không bỏ bước nào — đặc biệt là sao lưu cơ sở dữ liệu trước khi chạy migration.',
    folderId: 'f-work',
    labels: ['devops'],
    pinned: true,
    todos: [
      todo('Chốt danh sách thay đổi', true),
      todo('Sao lưu cơ sở dữ liệu', true),
      todo('Chạy migration trên môi trường thử'),
      todo('Cập nhật khoá truy cập production'),
      todo('Gửi thông báo cho nhóm'),
    ],
    updatedAt: ago(10),
  }),
  item({
    kind: 'login',
    title: 'Email công việc',
    username: 'ten.ban@congty.vn',
    secret: 'Tr4ng#Xanh27!mua',
    totp: 'JBSWY3DPEHPK3PXP',
    url: 'mail.congty.vn',
    secureNote: 'Tài khoản này dùng chung với nhóm vận hành.',
    folderId: 'f-work',
    labels: ['công-việc'],
    pinned: true,
    starred: true,
    updatedAt: ago(60 * 24 * 92),
  }),
  item({
    kind: 'task',
    title: 'Chuẩn bị họp sprint',
    body: 'Gom lại tiến độ hai tuần, chuẩn bị ba câu hỏi cho nhóm.',
    folderId: 'f-work',
    labels: ['công-việc'],
    todos: [todo('Gom số liệu sprint', true), todo('Viết ba câu hỏi'), todo('Gửi trước 15:30')],
    remindAt: ahead(2),
    updatedAt: ago(120),
  }),
  item({
    kind: 'secret',
    title: 'Payment Gateway — Secret',
    secret: 'demo-payment-gateway-secret-key-0000',
    folderId: 'f-work',
    labels: ['devops'],
    starred: true,
    updatedAt: ago(160),
  }),
  item({
    kind: 'link',
    title: 'Tài liệu thiết kế API',
    url: 'https://docs.congty.vn/api/design',
    body: 'Quy ước đặt tên endpoint và mã lỗi.',
    folderId: 'f-work',
    labels: ['devops'],
    updatedAt: ago(195),
  }),
  item({
    kind: 'note',
    title: 'Ý tưởng cải tiến dashboard',
    body: 'Gom thống kê theo tuần, thêm biểu đồ so sánh với tuần trước. Bỏ bớt bảng số liệu thô.',
    folderId: 'f-side',
    labels: ['ý-tưởng'],
    updatedAt: ago(210),
  }),
  item({
    kind: 'login',
    title: 'Máy chủ thử nghiệm (SSH)',
    username: 'deploy@staging',
    secret: 'st4ging-Deploy-2026',
    url: 'staging.congty.vn',
    folderId: 'f-work',
    labels: ['devops'],
    updatedAt: ago(240),
  }),
  item({
    kind: 'login',
    title: 'Ngân hàng điện tử',
    username: 'ten.ban.2841',
    secret: '123456',
    url: 'ebanking.example.vn',
    folderId: null,
    labels: ['tài-chính'],
    updatedAt: ago(60 * 24 * 40),
  }),
  item({
    kind: 'secret',
    title: 'Cloud Production — Access Key',
    secret: 'AKIAIOSFODNN7EXAMPLE',
    folderId: 'f-work',
    labels: ['devops'],
    updatedAt: ago(60 * 24 * 3),
  }),
  item({
    kind: 'login',
    title: 'Kho mã nguồn',
    username: 'ten-ban',
    secret: 'Git#Hub-2026!repo',
    totp: 'GEZDGNBVGY3TQOJQ',
    url: 'git.congty.vn',
    folderId: 'f-work',
    updatedAt: ago(60 * 24 * 12),
  }),
  item({
    kind: 'person',
    title: 'Căn cước công dân',
    secret: '001199012345',
    body: 'Cấp ngày 14/03/2021 tại Hà Nội. Bản gốc để trong két sắt ở nhà.',
    folderId: null,
    labels: ['giấy-tờ'],
    updatedAt: ago(60 * 24 * 60),
  }),
  item({
    kind: 'login',
    title: 'Wi-Fi nhà',
    username: 'NHA-5G',
    secret: 'nhaminh-2026',
    folderId: 'f-family',
    updatedAt: ago(60 * 24 * 20),
  }),
  item({
    kind: 'person',
    title: 'Hộ chiếu',
    secret: 'B1234567',
    body: 'Hết hạn 2031. Giữ cùng giấy tờ xe.',
    folderId: null,
    updatedAt: ago(60 * 24 * 80),
  }),
  item({
    kind: 'task',
    title: 'Kiểm tra deploy trước 17:00',
    body: 'Xác nhận bản phát hành đã lên production và không có lỗi trong log.',
    folderId: 'f-work',
    labels: ['devops'],
    todos: [todo('Xem log 30 phút gần nhất'), todo('Kiểm tra health check')],
    remindAt: ahead(5),
    updatedAt: ago(90),
  }),
  item({
    kind: 'task',
    title: 'Gọi cho mẹ',
    folderId: 'f-family',
    remindAt: ahead(8),
    updatedAt: ago(300),
  }),
  item({
    kind: 'task',
    title: 'Sao lưu ảnh tháng 10',
    body: 'Chép ảnh từ điện thoại sang ổ cứng ngoài, rồi xoá bớt ảnh trùng.',
    folderId: 'f-family',
    todos: [todo('Chép sang ổ cứng', true), todo('Xoá ảnh trùng')],
    updatedAt: ago(60 * 24 * 2),
  }),
  item({
    kind: 'task',
    title: 'Gia hạn bảo hiểm xe',
    body: 'Cá nhân · kèm ảnh giấy tờ trong két.',
    folderId: 'f-family',
    remindAt: ago(60 * 20),
    updatedAt: ago(60 * 24 * 5),
  }),
  item({
    kind: 'task',
    title: 'Đổi mật khẩu ngân hàng điện tử',
    body: 'Mật khẩu hiện tại quá yếu và đã dùng lâu.',
    folderId: null,
    labels: ['tài-chính'],
    remindAt: ahead(48),
    updatedAt: ago(60 * 24),
  }),
  item({
    kind: 'task',
    title: 'Đặt vé xe về quê',
    folderId: 'f-travel',
    remindAt: ahead(72),
    updatedAt: ago(60 * 24 * 4),
  }),
  item({
    kind: 'task',
    title: 'Nộp báo cáo tháng',
    folderId: 'f-work',
    remindAt: ahead(96),
    updatedAt: ago(60 * 24 * 6),
  }),
  item({
    kind: 'note',
    title: 'Kế hoạch sprint 22',
    body: 'Ba mục tiêu: hoàn thiện tìm kiếm, sửa lỗi đồng bộ, viết tài liệu cho nhóm mới.',
    folderId: 'f-work',
    labels: ['công-việc'],
    updatedAt: ago(60 * 24),
  }),
  item({
    kind: 'note',
    title: 'Ghi chép sự cố tháng 9',
    body: 'Nguyên nhân: migration thiếu chỉ mục. Cách xử lý: thêm chỉ mục rồi chạy lại. Bài học: luôn thử trên staging trước.',
    folderId: 'f-work',
    labels: ['sự-cố'],
    updatedAt: ago(60 * 24 * 8),
  }),
  item({
    kind: 'note',
    title: 'Sách cần đọc',
    body: '1. Refactoring — Martin Fowler\n2. Designing Data-Intensive Applications\n3. The Pragmatic Programmer',
    folderId: 'f-study',
    labels: ['học-tập'],
    updatedAt: ago(60 * 24 * 15),
  }),
  item({
    kind: 'link',
    title: 'Bảng theo dõi phát hành',
    url: 'https://docs.congty.vn/releases',
    folderId: 'f-work',
    labels: ['devops'],
    updatedAt: ago(60 * 24 * 7),
  }),
  item({
    kind: 'link',
    title: 'Hướng dẫn deploy tự động',
    url: 'https://docs.congty.vn/ci-cd',
    folderId: 'f-work',
    labels: ['devops'],
    updatedAt: ago(60 * 24 * 9),
  }),
  item({
    kind: 'link',
    title: 'Khoá học tiếng Anh',
    url: 'https://example.com/english',
    folderId: 'f-study',
    updatedAt: ago(60 * 24 * 22),
  }),
  item({
    kind: 'person',
    title: 'Số tài khoản bảo hiểm',
    secret: 'BH-99201847',
    body: 'Dùng khi làm hồ sơ y tế.',
    folderId: null,
    labels: ['giấy-tờ'],
    updatedAt: ago(60 * 24 * 45),
  }),
  item({
    kind: 'secret',
    title: 'Khoá ký ứng dụng',
    secret: 'ngan-sign-9f2a4c81e0',
    folderId: 'f-side',
    updatedAt: ago(60 * 24 * 30),
  }),
  item({
    kind: 'note',
    title: 'Công thức nấu ăn của mẹ',
    body: 'Nước dùng: xương ống ninh 3 tiếng, nêm muối sau cùng. Hành tím nướng cho thơm.',
    folderId: 'f-family',
    labels: ['gia-đình'],
    updatedAt: ago(60 * 24 * 50),
  }),
  item({
    kind: 'link',
    title: 'Bản đồ chuyến đi Đà Lạt',
    url: 'https://maps.example.com/dalat',
    folderId: 'f-travel',
    updatedAt: ago(60 * 24 * 18),
  }),
];

export const SEED_PAYLOAD: Payload = {
  items: SEED_ITEMS,
  folders: DEFAULT_FOLDERS,
  settings: DEFAULT_SETTINGS,
};

/**
 * The demo content is ordinary in every respect except its id prefix — that is
 * the only thing marking it. `uid()` in the store uses crypto.randomUUID, so an
 * item the user created can never be mistaken for seed.
 */
export const isSeedItem = (item: Item): boolean => item.id.startsWith('seed-');
