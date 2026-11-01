/**
 * MEMORY GALLERY - Client-side Storage & Demo Engine for GitHub Pages
 * Ensures the website runs 100% interactively on static hosting like GitHub Pages!
 */

(function() {
    // Check if we are running in static hosting (e.g. GitHub Pages or file://)
    const isStaticHost = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';

    // Initial starter data for GitHub Pages demo
    const defaultUsers = [
        {
            id: 1,
            username: 'baongoc',
            email: 'baongoc@memorygallery.com',
            full_name: 'Nguyễn Thị Bảo Ngọc',
            role: 'user',
            status: 'active',
            avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
            bio: 'Người yêu thích du lịch và lưu giữ những khoảnh khắc thanh xuân.',
            storage_quota: 21474836480,
            used_storage: 49932460
        },
        {
            id: 2,
            username: 'letrunghau',
            email: 'letrunghau@memorygallery.com',
            full_name: 'Lê Trung Hậu',
            role: 'admin',
            status: 'active',
            avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
            bio: 'Quản trị viên hệ thống Memory Gallery',
            storage_quota: 107374182400,
            used_storage: 12582912000
        }
    ];

    const defaultAlbums = [
        { id: 1, user_id: 1, title: 'Chuyến đi Đà Lạt 2024', description: 'Những ngày rong ruổi giữa sương mù và đồi thông mộng mơ cùng nhóm bạn thân.', cover_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80', category: 'Du lịch', total_photos: 4, total_videos: 0, total_items: 4 },
        { id: 2, user_id: 1, title: 'Khoảnh khắc Gia Đình', description: 'Bữa cơm sum vầy, tiếng cười trẻ thơ và tình yêu thương vô bờ bến bên cha mẹ.', cover_url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80', category: 'Gia đình', total_photos: 1, total_videos: 0, total_items: 1 },
        { id: 3, user_id: 1, title: 'Kỷ niệm Thanh Xuân', description: 'Thời sinh viên nông nổi, những buổi chiều hoàng hôn bên hồ và những ước mơ tuổi trẻ.', cover_url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80', category: 'Thanh xuân', total_photos: 2, total_videos: 0, total_items: 2 },
        { id: 4, user_id: 1, title: 'Sinh nhật tuổi 24', description: 'Tiệc mừng sinh nhật ấm cúng bên người thân với ánh nến lung linh và những lời chúc.', cover_url: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&auto=format&fit=crop&q=80', category: 'Sinh nhật', total_photos: 1, total_videos: 0, total_items: 1 },
        { id: 5, user_id: 1, title: 'Hành trình Xuyên Việt', description: 'Dọc theo bờ biển miền Trung qua những cung đèo ngoạn mục và những bãi biển hoang sơ.', cover_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80', category: 'Du lịch', total_photos: 2, total_videos: 1, total_items: 3 }
    ];

    const currentYear = new Date().getFullYear();
    const mm = String(new Date().getMonth() + 1).padStart(2, '0');
    const dd = String(new Date().getDate()).padStart(2, '0');
    const todayMD = `${mm}-${dd}`;

    const defaultMemories = [
        { id: 1, user_id: 1, album_id: 1, album_title: 'Chuyến đi Đà Lạt 2024', title: 'Bình minh đồi chè Cầu Đất', description: 'Sương mai giăng kín thung lũng, ánh mặt trời le lói qua từng đọt chè xanh ngát.', file_path: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80', file_name: 'cau_dat_sunrise.jpg', file_type: 'image', file_size: 3840210, memory_date: `${currentYear - 1}-${todayMD}`, location: 'Đà Lạt, Lâm Đồng', is_favorite: 1, tags: [{id: 1, name: 'Du lịch'}, {id: 2, name: 'Đà Lạt'}] },
        { id: 2, user_id: 1, album_id: 1, album_title: 'Chuyến đi Đà Lạt 2024', title: 'Cà phê hoàng hôn dốc đá', description: 'Ngồi nhâm nhi tách trà thơm ngắm nhìn thành phố lấp lánh ánh đèn khi chiều buông.', file_path: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200&auto=format&fit=crop&q=80', file_name: 'cafe_hoang_hon.jpg', file_type: 'image', file_size: 2940120, memory_date: `${currentYear - 1}-${todayMD}`, location: 'Dốc Nhà Bò, Đà Lạt', is_favorite: 1, tags: [{id: 2, name: 'Đà Lạt'}, {id: 6, name: 'Hoàng hôn'}] },
        { id: 3, user_id: 1, album_id: 2, album_title: 'Khoảnh khắc Gia Đình', title: 'Bữa cơm tất niên gia đình', description: 'Cả nhà quây quần bên nồi bánh chưng nghi ngút khói, nghe ba mẹ kể chuyện xưa.', file_path: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200&auto=format&fit=crop&q=80', file_name: 'family_dinner.jpg', file_type: 'image', file_size: 4120900, memory_date: '2025-01-28', location: 'Hà Nội, Việt Nam', is_favorite: 1, tags: [{id: 3, name: 'Gia đình'}] },
        { id: 4, user_id: 1, album_id: 3, album_title: 'Kỷ niệm Thanh Xuân', title: 'Lễ tốt nghiệp đại học', description: 'Khoảnh khắc tung mũ cử nhân đánh dấu chặng đường 4 năm thanh xuân rực rỡ.', file_path: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=80', file_name: 'graduation_day.jpg', file_type: 'image', file_size: 3450120, memory_date: '2024-06-25', location: 'Đại Học Quốc Gia', is_favorite: 1, tags: [{id: 4, name: 'Thanh xuân'}] },
        { id: 5, user_id: 1, album_id: 1, album_title: 'Chuyến đi Đà Lạt 2024', title: 'Rừng thông trong làn sương sớm', description: 'Một sớm bình yên đi bộ dưới bóng thông reo, hít thở không khí se se lạnh của vùng cao nguyên.', file_path: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200&auto=format&fit=crop&q=80', file_name: 'pine_forest.jpg', file_type: 'image', file_size: 5120300, memory_date: `${currentYear - 2}-${todayMD}`, location: 'Đồi Robin, Đà Lạt', is_favorite: 0, tags: [{id: 1, name: 'Du lịch'}, {id: 2, name: 'Đà Lạt'}] },
        { id: 6, user_id: 1, album_id: 4, album_title: 'Sinh nhật tuổi 24', title: 'Ngọn nến ước nguyện sinh nhật', description: 'Thổi nến sinh nhật tuổi 24 và cầu chúc một năm mới tràn ngập bình an.', file_path: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=1200&auto=format&fit=crop&q=80', file_name: 'birthday_cake.jpg', file_type: 'image', file_size: 2410880, memory_date: '2024-08-14', location: 'TP. Hồ Chí Minh', is_favorite: 0, tags: [{id: 5, name: 'Sinh nhật'}] },
        { id: 7, user_id: 1, album_id: 5, album_title: 'Hành trình Xuyên Việt', title: 'Chuyến cắm trại hồ Trị An', description: 'Đêm nằm ngắm dải ngân hà lấp lánh và hát nghêu ngao bên đốm lửa trại bập bùng.', file_path: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&auto=format&fit=crop&q=80', file_name: 'camping_tri_an.jpg', file_type: 'image', file_size: 4810230, memory_date: `${currentYear - 3}-${todayMD}`, location: 'Đồng Nai, Việt Nam', is_favorite: 1, tags: [{id: 1, name: 'Du lịch'}, {id: 8, name: 'Camping'}] },
        { id: 8, user_id: 1, album_id: 5, album_title: 'Hành trình Xuyên Việt', title: 'Khoảnh khắc lướt sóng biển', description: 'Video ngắn ghi lại một buổi chiều chèo SUP và đón những con sóng bạc đầu.', file_path: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', file_name: 'sea_waves.mp4', file_type: 'video', file_size: 15829100, memory_date: '2025-07-20', location: 'Biển Quy Nhơn', is_favorite: 1, tags: [{id: 1, name: 'Du lịch'}] },
        { id: 9, user_id: 1, album_id: 3, album_title: 'Kỷ niệm Thanh Xuân', title: 'Chiều thu Hà Nội rực nắng vàng', description: 'Lá vàng rơi ngập lối ven hồ Tây, gió heo may se lạnh đầu mùa.', file_path: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80', file_name: 'hanoi_autumn.jpg', file_type: 'image', file_size: 3210450, memory_date: '2024-10-15', location: 'Hồ Tây, Hà Nội', is_favorite: 1, tags: [{id: 4, name: 'Thanh xuân'}] },
        { id: 10, user_id: 1, album_id: 5, album_title: 'Hành trình Xuyên Việt', title: 'Khoảnh khắc vượt đèo Hải Vân', description: 'Cung đường đèo uốn lượn ngoạn mục giữa mây trời và biển xanh ngắt.', file_path: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80', file_name: 'hai_van_pass.jpg', file_type: 'image', file_size: 4200150, memory_date: '2025-04-30', location: 'Đèo Hải Vân, Đà Nẵng', is_favorite: 0, tags: [{id: 1, name: 'Du lịch'}] }
    ];

    // Initialize in localStorage if not exists
    if (!localStorage.getItem('mg_users')) {
        localStorage.setItem('mg_users', JSON.stringify(defaultUsers));
    }
    if (!localStorage.getItem('mg_albums')) {
        localStorage.setItem('mg_albums', JSON.stringify(defaultAlbums));
    }
    if (!localStorage.getItem('mg_memories')) {
        localStorage.setItem('mg_memories', JSON.stringify(defaultMemories));
    }

    // Helper functions for mock data
    function getStored(key) {
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch(e) { return []; }
    }
    function setStored(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    }

    window.MockEngine = {
        isStaticHost,

        handleRequest(url, options = {}) {
            const method = (options.method || 'GET').toUpperCase();
            const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body || '{}') : {}) : {};
            const cleanUrl = url.split('?')[0].replace(/^\//, '');
            const params = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');

            // Auth Me
            if (cleanUrl.endsWith('api/auth/me')) {
                const token = localStorage.getItem('mg_token');
                const users = getStored('mg_users');
                const user = users.find(u => String(u.id) === String(token));
                if (user) {
                    return { ok: true, status: 200, json: async () => ({ authenticated: true, user }) };
                }
                return { ok: true, status: 200, json: async () => ({ authenticated: false, user: null }) };
            }

            // Auth Login
            if (cleanUrl.endsWith('api/auth/login')) {
                const identity = (body.identity || '').toLowerCase().trim();
                const pass = body.password || '';
                const users = getStored('mg_users');
                const user = users.find(u => (u.email.toLowerCase() === identity || u.username.toLowerCase() === identity));

                if (user && pass === '123456') {
                    return { ok: true, status: 200, json: async () => ({ message: 'Đăng nhập thành công!', user, token: String(user.id) }) };
                }
                return { ok: false, status: 401, json: async () => ({ error: 'Tài khoản hoặc mật khẩu không đúng (Mật khẩu mặc định: 123456)' }) };
            }

            // Auth Logout
            if (cleanUrl.endsWith('api/auth/logout')) {
                return { ok: true, status: 200, json: async () => ({ message: 'Đã đăng xuất' }) };
            }

            // Stats
            if (cleanUrl.endsWith('api/stats')) {
                const memories = getStored('mg_memories');
                const albums = getStored('mg_albums');
                const photos = memories.filter(m => m.file_type === 'image');
                const videos = memories.filter(m => m.file_type === 'video');
                const favs = memories.filter(m => m.is_favorite == 1);
                const user = getStored('mg_users')[0];

                return {
                    ok: true, status: 200, json: async () => ({
                        greeting: 'Chào mừng bạn đến với Memory Gallery!',
                        sub_greeting: 'Lưu giữ những khoảnh khắc đẹp nhất của cuộc sống.',
                        user_name: user ? user.full_name : 'Bảo Ngọc',
                        stats: {
                            total_photos: photos.length,
                            total_videos: videos.length,
                            total_albums: albums.length,
                            total_favorites: favs.length,
                            used_formatted: '47.6 MB',
                            quota_formatted: '20 GB',
                            used_percent: 0.2,
                            on_this_day_count: 3
                        },
                        recent_memories: memories.slice(0, 8),
                        recent_albums: albums.slice(0, 4)
                    })
                };
            }

            // Memories List
            if (cleanUrl.endsWith('api/memories')) {
                let memories = getStored('mg_memories');
                const type = params.get('type');
                const fav = params.get('favorite');
                const search = params.get('search');
                const albumId = params.get('album_id');

                if (type && type !== 'all') memories = memories.filter(m => m.file_type === type);
                if (fav === '1') memories = memories.filter(m => m.is_favorite == 1);
                if (albumId) memories = memories.filter(m => String(m.album_id) === String(albumId));
                if (search) {
                    const s = search.toLowerCase();
                    memories = memories.filter(m => (m.title && m.title.toLowerCase().includes(s)) || (m.location && m.location.toLowerCase().includes(s)));
                }

                return { ok: true, status: 200, json: async () => ({ count: memories.length, memories }) };
            }

            // Memories Details
            const memDetailMatch = cleanUrl.match(/api\/memories\/(\d+)/);
            if (memDetailMatch) {
                const id = parseInt(memDetailMatch[1]);
                const memory = getStored('mg_memories').find(m => m.id === id);
                if (memory) {
                    return { ok: true, status: 200, json: async () => ({ memory }) };
                }
            }

            // Toggle favorite
            if (cleanUrl.endsWith('api/memories/toggle_favorite')) {
                const id = body.id;
                const memories = getStored('mg_memories');
                const mem = memories.find(m => m.id == id);
                if (mem) {
                    mem.is_favorite = mem.is_favorite ? 0 : 1;
                    setStored('mg_memories', memories);
                    return { ok: true, status: 200, json: async () => ({ message: 'Thành công', is_favorite: mem.is_favorite }) };
                }
            }

            // Albums List
            if (cleanUrl.endsWith('api/albums')) {
                const albums = getStored('mg_albums');
                return { ok: true, status: 200, json: async () => ({ count: albums.length, albums }) };
            }

            // Album Details
            const albDetailMatch = cleanUrl.match(/api\/albums\/(\d+)/);
            if (albDetailMatch) {
                const id = parseInt(albDetailMatch[1]);
                const album = getStored('mg_albums').find(a => a.id === id);
                if (album) {
                    const memories = getStored('mg_memories').filter(m => m.album_id === id);
                    album.memories = memories;
                    return { ok: true, status: 200, json: async () => ({ album }) };
                }
            }

            // Timeline
            if (cleanUrl.endsWith('api/timeline')) {
                const memories = getStored('mg_memories');
                return {
                    ok: true, status: 200, json: async () => ({
                        available_years: ['2025', '2024', '2023'],
                        total_memories: memories.length,
                        timeline: [
                            { year: '2025', total: 4, months: [{ month: '11', month_name: 'Tháng 11', total: 2, items: memories.slice(0, 2) }, { month: '07', month_name: 'Tháng 07', total: 1, items: [memories[7]] }, { month: '01', month_name: 'Tháng 01', total: 1, items: [memories[2]] }] },
                            { year: '2024', total: 4, months: [{ month: '11', month_name: 'Tháng 11', total: 1, items: [memories[4]] }, { month: '10', month_name: 'Tháng 10', total: 1, items: [memories[8]] }, { month: '06', month_name: 'Tháng 06', total: 1, items: [memories[3]] }, { month: '08', month_name: 'Tháng 08', total: 1, items: [memories[5]] }] },
                            { year: '2023', total: 2, months: [{ month: '11', month_name: 'Tháng 11', total: 1, items: [memories[6]] }] }
                        ]
                    })
                };
            }

            // On This Day
            if (cleanUrl.endsWith('api/on-this-day')) {
                const memories = getStored('mg_memories');
                return {
                    ok: true, status: 200, json: async () => ({
                        target_date: new Date().toISOString().split('T')[0],
                        has_memories: true,
                        total_memories: 3,
                        groups: [
                            { year: currentYear - 1, label: '1 năm trước (' + (currentYear - 1) + ')', memories: memories.slice(0, 2) },
                            { year: currentYear - 2, label: '2 năm trước (' + (currentYear - 2) + ')', memories: [memories[4]] },
                            { year: currentYear - 3, label: '3 năm trước (' + (currentYear - 3) + ')', memories: [memories[6]] }
                        ]
                    })
                };
            }

            // Admin Overview
            if (cleanUrl.endsWith('api/admin/overview') || cleanUrl.endsWith('api/admin')) {
                return {
                    ok: true, status: 200, json: async () => ({
                        stats: { total_users: 2, active_users: 2, suspended_users: 0, total_photos: 9, total_videos: 1, total_albums: 5, formatted_storage: '47.6 MB' },
                        upload_trends: [{ month: '2025-06', uploads_count: 3 }, { month: '2025-07', uploads_count: 2 }, { month: '2025-10', uploads_count: 5 }],
                        recent_logs: [
                            { action: 'LOGIN', details: 'Lê Trung Hậu đăng nhập vào hệ thống', created_at: '2026-11-01 22:30:00' },
                            { action: 'UPLOAD', details: 'Nguyễn Thị Bảo Ngọc tải lên 2 ảnh mới', created_at: '2026-11-01 22:15:00' }
                        ]
                    })
                };
            }

            // Admin Users
            if (cleanUrl.endsWith('api/admin/users')) {
                return { ok: true, status: 200, json: async () => ({ users: getStored('mg_users') }) };
            }

            return null; // Fall through to real fetch
        }
    };
})();

