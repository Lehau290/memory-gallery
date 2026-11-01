/**
 * MEMORY GALLERY - Core Single Page Application Logic
 */

// Global transparent Fetch wrapper to inject JWT Auth Bearer token
const _nativeFetch = window.fetch;
window.fetch = function(url, options = {}) {
    options = options || {};
    options.headers = options.headers || {};
    const token = localStorage.getItem('mg_token');
    if (token) {
        if (options.headers instanceof Headers) {
            options.headers.set('Authorization', 'Bearer ' + token);
        } else if (Array.isArray(options.headers)) {
            options.headers.push(['Authorization', 'Bearer ' + token]);
        } else {
            options.headers['Authorization'] = 'Bearer ' + token;
        }
    }
    return _nativeFetch(url, options);
};

const App = {
    user: null,
    currentRoute: 'dashboard',
    theme: localStorage.getItem('mg_theme') || 'light',
    lightboxIndex: 0,
    currentMemories: [],
    selectedMemoryIds: new Set(),
    batchMode: false,
    zoomLevel: 1,
    activeAlbumId: null,

    // Initialize Application
    async init() {
        this.applyTheme(this.theme);
        this.bindEvents();
        await this.checkAuth();
        this.handleRouting();
    },

    // Theme Management
    applyTheme(theme) {
        this.theme = theme;
        localStorage.setItem('mg_theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        this.updateThemeIcons();
    },

    toggleTheme() {
        this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
    },

    updateThemeIcons() {
        const icons = document.querySelectorAll('.theme-toggle-icon');
        icons.forEach(el => {
            el.setAttribute('data-lucide', this.theme === 'dark' ? 'sun' : 'moon');
        });
        if (window.lucide) lucide.createIcons();
    },

    // Authentication Checks
    async checkAuth() {
        try {
            const res = await fetch('api/auth/me');
            const data = await res.json();
            if (data.authenticated && data.user) {
                this.user = data.user;
                this.renderUserUI();
            } else {
                this.user = null;
                this.renderGuestUI();
            }
        } catch (e) {
            console.error('Auth check error:', e);
            this.user = null;
            this.renderGuestUI();
        }
    },

    renderUserUI() {
        document.getElementById('auth-modal')?.classList.add('hidden');
        document.getElementById('app-container')?.classList.remove('blur-sm');
        
        // Update user elements
        const nameEls = document.querySelectorAll('.user-fullname');
        nameEls.forEach(el => el.textContent = this.user.full_name || this.user.username);
        
        const emailEls = document.querySelectorAll('.user-email');
        emailEls.forEach(el => el.textContent = this.user.email);

        const avatarEls = document.querySelectorAll('.user-avatar-img');
        avatarEls.forEach(el => {
            el.src = this.user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80';
        });

        // Admin menu visibility
        const adminLinks = document.querySelectorAll('.admin-nav-item');
        adminLinks.forEach(el => {
            if (this.user.role === 'admin') {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });

        if (window.lucide) lucide.createIcons();
    },

    renderGuestUI() {
        this.openAuthModal('login');
    },

    openAuthModal(tab = 'login') {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        this.switchAuthTab(tab);
    },

    closeAuthModal() {
        if (!this.user) {
            this.toast('Vui lòng đăng nhập để tiếp tục khám phá.', 'info');
            return;
        }
        document.getElementById('auth-modal')?.classList.add('hidden');
    },

    switchAuthTab(tab) {
        const loginForm = document.getElementById('login-form-panel');
        const regForm = document.getElementById('register-form-panel');
        const loginTabBtn = document.getElementById('tab-btn-login');
        const regTabBtn = document.getElementById('tab-btn-register');

        if (tab === 'login') {
            loginForm?.classList.remove('hidden');
            regForm?.classList.add('hidden');
            loginTabBtn?.classList.add('text-purple-600', 'border-b-2', 'border-purple-600', 'dark:text-purple-400');
            loginTabBtn?.classList.remove('text-stone-400');
            regTabBtn?.classList.remove('text-purple-600', 'border-b-2', 'border-purple-600', 'dark:text-purple-400');
            regTabBtn?.classList.add('text-stone-400');
        } else {
            loginForm?.classList.add('hidden');
            regForm?.classList.remove('hidden');
            regTabBtn?.classList.add('text-purple-600', 'border-b-2', 'border-purple-600', 'dark:text-purple-400');
            regTabBtn?.classList.remove('text-stone-400');
            loginTabBtn?.classList.remove('text-purple-600', 'border-b-2', 'border-purple-600', 'dark:text-purple-400');
            loginTabBtn?.classList.add('text-stone-400');
        }
        if (window.lucide) lucide.createIcons();
    },

    async handleLogin(e) {
        e.preventDefault();
        const form = e.target;
        const identity = form.identity.value.trim();
        const password = form.password.value;
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="inline-block animate-spin mr-2">◌</span> Đang đăng nhập...`;

        try {
            const res = await fetch('api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity, password })
            });
            const data = await res.json();
            if (res.ok) {
                this.user = data.user;
                if (data.token) {
                    localStorage.setItem('mg_token', data.token);
                }
                this.toast('Chào mừng bạn quay trở lại!', 'success');
                this.renderUserUI();
                this.navigate('dashboard');
            } else {
                this.toast(data.error || 'Đăng nhập không thành công', 'error');
            }
        } catch (err) {
            this.toast('Lỗi kết nối máy chủ', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `Đăng nhập`;
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const form = e.target;
        const fullName = form.full_name.value.trim();
        const username = form.username.value.trim();
        const email = form.email.value.trim();
        const password = form.password.value;
        const confirmPassword = form.confirm_password.value;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (password !== confirmPassword) {
            this.toast('Mật khẩu xác nhận không trùng khớp!', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="inline-block animate-spin mr-2">◌</span> Đang tạo tài khoản...`;

        try {
            const res = await fetch('api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    username: username,
                    email: email,
                    password: password,
                    confirm_password: confirmPassword
                })
            });
            const data = await res.json();
            if (res.ok) {
                this.user = data.user;
                if (data.token) {
                    localStorage.setItem('mg_token', data.token);
                }
                this.toast('Tạo tài khoản thành công! Chào mừng bạn.', 'success');
                this.renderUserUI();
                this.navigate('dashboard');
            } else {
                this.toast(data.error || 'Đăng ký thất bại', 'error');
            }
        } catch (err) {
            this.toast('Lỗi kết nối máy chủ', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `Tạo không gian kỷ niệm`;
        }
    },

    async handleLogout() {
        if (!confirm('Bạn có chắc chắn muốn đăng xuất?')) return;
        try {
            await fetch('api/auth/logout');
            localStorage.removeItem('mg_token');
            this.user = null;
            this.toast('Đã đăng xuất thành công.', 'info');
            this.renderGuestUI();
        } catch (e) {
            console.error(e);
        }
    },

    fillDemoAccount(type = 'demo') {
        const loginForm = document.getElementById('login-form');
        if (!loginForm) return;
        if (type === 'admin') {
            loginForm.identity.value = 'letrunghau@memorygallery.com';
            loginForm.password.value = '123456';
            this.toast('Đã điền tài khoản Quản trị viên (Lê Trung Hậu). Nhấn Đăng nhập để tiếp tục!', 'info');
        } else {
            loginForm.identity.value = 'baongoc@memorygallery.com';
            loginForm.password.value = '123456';
            this.toast('Đã điền tài khoản Người dùng (Nguyễn Thị Bảo Ngọc). Nhấn Đăng nhập để tiếp tục!', 'info');
        }
    },

    // Routing System
    handleRouting() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '') || 'dashboard';
            this.navigate(hash, false);
        });
        const initialHash = window.location.hash.replace('#', '') || 'dashboard';
        this.navigate(initialHash, false);
    },

    navigate(route, updateHash = true) {
        if (!this.user && route !== 'login') {
            this.openAuthModal('login');
            return;
        }

        // Support sub-routes like album-detail:123
        let routeName = route;
        let routeParam = null;
        if (route.includes(':')) {
            const parts = route.split(':');
            routeName = parts[0];
            routeParam = parts[1];
        }

        this.currentRoute = routeName;
        if (updateHash) {
            window.location.hash = route;
        }

        // Update active sidebar nav
        document.querySelectorAll('.nav-link').forEach(link => {
            const linkRoute = link.getAttribute('data-route');
            if (linkRoute === routeName) {
                link.classList.add('bg-purple-100', 'text-purple-800', 'dark:bg-purple-950/60', 'dark:text-purple-300', 'font-semibold');
                link.classList.remove('text-stone-600', 'dark:text-stone-400');
            } else {
                link.classList.remove('bg-purple-100', 'text-purple-800', 'dark:bg-purple-950/60', 'dark:text-purple-300', 'font-semibold');
                link.classList.add('text-stone-600', 'dark:text-stone-400');
            }
        });

        // Hide mobile sidebar if open
        document.getElementById('mobile-sidebar')?.classList.add('-translate-x-full');

        // Render target view
        switch (routeName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'all-memories':
                this.renderMemoriesView({ title: 'Tất cả kỷ niệm', type: 'all' });
                break;
            case 'photos':
                this.renderMemoriesView({ title: 'Thư viện ảnh', type: 'image' });
                break;
            case 'videos':
                this.renderMemoriesView({ title: 'Thư viện video', type: 'video' });
                break;
            case 'favorites':
                this.renderMemoriesView({ title: 'Kỷ niệm yêu thích', favorite: 1 });
                break;
            case 'albums':
                this.renderAlbumsView();
                break;
            case 'album-detail':
                this.renderAlbumDetailView(routeParam);
                break;
            case 'timeline':
                this.renderTimelineView();
                break;
            case 'on-this-day':
                this.renderOnThisDayView();
                break;
            case 'search':
                this.renderSearchView();
                break;
            case 'upload':
                this.renderUploadView();
                break;
            case 'profile':
                this.renderProfileView();
                break;
            case 'settings':
                this.renderSettingsView();
                break;
            case 'admin':
                this.renderAdminView();
                break;
            default:
                this.renderDashboard();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // View: Dashboard
    async renderDashboard() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center p-12">
                <div class="inline-block animate-spin text-purple-600 text-3xl">◌</div>
            </div>
        `;

        try {
            const res = await fetch('api/stats');
            const data = await res.json();
            
            const stats = data.stats;
            const memories = data.recent_memories || [];
            const albums = data.recent_albums || [];

            container.innerHTML = `
                <div class="space-y-8 animate-fade-in pb-12">
                    <!-- Top Welcome Banner -->
                    <div class="relative overflow-hidden rounded-3xl p-8 glass bg-gradient-to-br from-purple-500/10 via-amber-500/5 to-rose-500/10 border border-purple-200/40 dark:border-purple-800/30">
                        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 mb-3">
                                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                                    Memory Gallery • Digital Diary
                                </span>
                                <h1 class="text-3xl sm:text-4xl font-bold font-serif text-stone-900 dark:text-white mb-2">
                                    ${data.greeting} ${data.user_name} 👋
                                </h1>
                                <p class="text-stone-600 dark:text-stone-300 max-w-xl text-base">
                                    ${data.sub_greeting}
                                </p>
                            </div>
                            <div class="flex items-center gap-3">
                                <button onclick="App.navigate('upload')" class="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all flex items-center gap-2">
                                    <i data-lucide="plus-circle" class="w-5 h-5"></i>
                                    <span>Tải kỷ niệm lên</span>
                                </button>
                                ${stats.on_this_day_count > 0 ? `
                                    <button onclick="App.navigate('on-this-day')" class="px-4 py-3 rounded-2xl glass hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-medium transition-all flex items-center gap-2 relative">
                                        <i data-lucide="history" class="w-5 h-5"></i>
                                        <span>Ngày này năm xưa</span>
                                        <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center animate-bounce">
                                            ${stats.on_this_day_count}
                                        </span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Metric Cards -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        <div class="glass p-5 rounded-3xl hover:shadow-md transition">
                            <div class="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-3">
                                <span class="text-xs font-semibold uppercase tracking-wider">Tổng số ảnh</span>
                                <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-300 flex items-center justify-center">
                                    <i data-lucide="image" class="w-5 h-5"></i>
                                </div>
                            </div>
                            <div class="text-3xl font-bold font-serif text-stone-900 dark:text-white">${stats.total_photos}</div>
                            <div class="text-xs text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-1">
                                <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-500"></i> Đã lưu trữ an toàn
                            </div>
                        </div>

                        <div class="glass p-5 rounded-3xl hover:shadow-md transition">
                            <div class="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-3">
                                <span class="text-xs font-semibold uppercase tracking-wider">Tổng số video</span>
                                <div class="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-300 flex items-center justify-center">
                                    <i data-lucide="film" class="w-5 h-5"></i>
                                </div>
                            </div>
                            <div class="text-3xl font-bold font-serif text-stone-900 dark:text-white">${stats.total_videos}</div>
                            <div class="text-xs text-stone-500 dark:text-stone-400 mt-1">Hỗ trợ phát trực tiếp HD</div>
                        </div>

                        <div class="glass p-5 rounded-3xl hover:shadow-md transition">
                            <div class="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-3">
                                <span class="text-xs font-semibold uppercase tracking-wider">Album kỷ niệm</span>
                                <div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-300 flex items-center justify-center">
                                    <i data-lucide="folder-heart" class="w-5 h-5"></i>
                                </div>
                            </div>
                            <div class="text-3xl font-bold font-serif text-stone-900 dark:text-white">${stats.total_albums}</div>
                            <div class="text-xs text-stone-500 dark:text-stone-400 mt-1">Phân loại theo chủ đề</div>
                        </div>

                        <div class="glass p-5 rounded-3xl hover:shadow-md transition">
                            <div class="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-3">
                                <span class="text-xs font-semibold uppercase tracking-wider">Dung lượng sử dụng</span>
                                <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center justify-center">
                                    <i data-lucide="hard-drive" class="w-5 h-5"></i>
                                </div>
                            </div>
                            <div class="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white truncate">
                                ${stats.used_formatted} <span class="text-xs font-normal text-stone-400">/ ${stats.quota_formatted}</span>
                            </div>
                            <div class="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-2 mt-3 overflow-hidden">
                                <div class="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all" style="width: ${Math.min(100, Math.max(2, stats.used_percent))}%"></div>
                            </div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400 mt-1.5 flex justify-between">
                                <span>Đã dùng ${stats.used_percent}%</span>
                                <span>Tiết kiệm & tối ưu</span>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Albums Section -->
                    ${albums.length > 0 ? `
                        <div>
                            <div class="flex items-center justify-between mb-4">
                                <div class="flex items-center gap-2">
                                    <i data-lucide="folder" class="w-5 h-5 text-purple-600"></i>
                                    <h2 class="text-xl font-bold font-serif text-stone-900 dark:text-white">Album gần đây</h2>
                                </div>
                                <button onclick="App.navigate('albums')" class="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                                    Xem tất cả <i data-lucide="chevron-right" class="w-4 h-4"></i>
                                </button>
                            </div>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                ${albums.map(alb => `
                                    <div onclick="App.navigate('album-detail:${alb.id}')" class="group cursor-pointer glass rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                                        <div class="relative h-36 overflow-hidden">
                                            <img src="${alb.cover_url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${alb.title}">
                                            <span class="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-medium">
                                                ${alb.items_count} mục
                                            </span>
                                            <span class="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/80 dark:bg-stone-900/80 backdrop-blur-md text-stone-800 dark:text-stone-200 text-[10px] font-semibold">
                                                ${alb.category || 'Kỷ niệm'}
                                            </span>
                                        </div>
                                        <div class="p-3">
                                            <h3 class="font-bold text-stone-800 dark:text-stone-100 text-sm truncate">${alb.title}</h3>
                                            <p class="text-stone-500 dark:text-stone-400 text-xs truncate mt-0.5">${alb.description || 'Chưa có mô tả'}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Recent Memories Masonry Section -->
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-2">
                                <i data-lucide="sparkles" class="w-5 h-5 text-purple-600"></i>
                                <h2 class="text-xl font-bold font-serif text-stone-900 dark:text-white">Kỷ niệm mới nhất</h2>
                            </div>
                            <button onclick="App.navigate('all-memories')" class="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                                Khám phá thư viện <i data-lucide="chevron-right" class="w-4 h-4"></i>
                            </button>
                        </div>
                        ${memories.length > 0 ? `
                            <div class="masonry-grid">
                                ${memories.map((m, idx) => this.renderMemoryCard(m, idx)).join('')}
                            </div>
                        ` : `
                            <div class="glass p-12 rounded-3xl text-center">
                                <div class="w-16 h-16 mx-auto rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                                    <i data-lucide="camera" class="w-8 h-8"></i>
                                </div>
                                <h3 class="text-lg font-bold text-stone-800 dark:text-white mb-1">Chưa có kỷ niệm nào</h3>
                                <p class="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-sm mx-auto">
                                    Hãy tải lên những bức ảnh và video đầu tiên để bắt đầu xây dựng cuốn nhật ký kỹ thuật số của bạn.
                                </p>
                                <button onclick="App.navigate('upload')" class="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition">
                                    Tải kỷ niệm ngay
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="p-8 text-rose-500">Lỗi khi tải dữ liệu trang chủ.</div>`;
        }
    },

    // View: Memories (All, Photos, Videos, Favorites)
    async renderMemoriesView(options = {}) {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center p-12">
                <div class="inline-block animate-spin text-purple-600 text-3xl">◌</div>
            </div>
        `;

        const title = options.title || 'Tất cả kỷ niệm';
        const type = options.type || 'all';
        const favorite = options.favorite !== undefined ? options.favorite : '';
        const albumId = options.albumId || '';

        try {
            let url = `api/memories?type=${type}`;
            if (favorite !== '') url += `&favorite=${favorite}`;
            if (albumId !== '') url += `&album_id=${albumId}`;

            const res = await fetch(url);
            const data = await res.json();
            this.currentMemories = data.memories || [];
            this.selectedMemoryIds.clear();

            container.innerHTML = `
                <div class="space-y-6 animate-fade-in pb-16">
                    <!-- Header Bar -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 class="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-white">
                                ${title}
                            </h1>
                            <p class="text-stone-500 dark:text-stone-400 text-sm mt-0.5">
                                Đang hiển thị <span class="font-semibold text-purple-600 dark:text-purple-400">${this.currentMemories.length}</span> kỷ niệm
                            </p>
                        </div>
                        
                        <!-- Toolbar Controls -->
                        <div class="flex flex-wrap items-center gap-2">
                            <!-- Batch Actions Toggle -->
                            <button id="btn-toggle-batch" onclick="App.toggleBatchMode()" class="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                                <i data-lucide="check-square" class="w-4 h-4"></i>
                                <span>Chọn nhiều</span>
                            </button>

                            <!-- Sort Selector -->
                            <select onchange="App.sortMemories(this.value)" class="glass px-3 py-2 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 outline-none">
                                <option value="date-desc">Ngày kỷ niệm: Mới nhất</option>
                                <option value="date-asc">Ngày kỷ niệm: Cũ nhất</option>
                                <option value="created-desc">Ngày tải lên gần đây</option>
                                <option value="title-asc">Tên kỷ niệm (A - Z)</option>
                            </select>

                            <button onclick="App.navigate('upload')" class="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition flex items-center gap-1.5 shadow-sm">
                                <i data-lucide="plus" class="w-4 h-4"></i>
                                <span>Thêm kỷ niệm</span>
                            </button>
                        </div>
                    </div>

                    <!-- Batch Floating Toolbar -->
                    <div id="batch-toolbar" class="hidden glass p-3 rounded-2xl flex items-center justify-between gap-4 border border-purple-300 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40">
                        <div class="flex items-center gap-2 text-xs font-medium text-purple-900 dark:text-purple-200">
                            <span id="batch-count" class="font-bold">0</span> mục đã được chọn
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="App.selectAllMemories()" class="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-medium hover:bg-stone-50">
                                Chọn tất cả
                            </button>
                            <button onclick="App.batchDownload()" class="px-3 py-1.5 rounded-lg text-xs bg-indigo-600 text-white font-medium hover:bg-indigo-700 flex items-center gap-1">
                                <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải về (Zip)
                            </button>
                            <button onclick="App.batchDelete()" class="px-3 py-1.5 rounded-lg text-xs bg-rose-600 text-white font-medium hover:bg-rose-700 flex items-center gap-1">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Xóa
                            </button>
                            <button onclick="App.toggleBatchMode(false)" class="p-1.5 text-stone-500 hover:text-stone-800">
                                <i data-lucide="x" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Media Grid Container -->
                    <div id="memories-container">
                        ${this.renderMemoriesGrid()}
                    </div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="p-8 text-rose-500">Lỗi khi tải danh sách kỷ niệm.</div>`;
        }
    },

    renderMemoriesGrid() {
        if (!this.currentMemories || this.currentMemories.length === 0) {
            return `
                <div class="glass p-16 rounded-3xl text-center">
                    <div class="w-16 h-16 mx-auto rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                        <i data-lucide="image-off" class="w-8 h-8"></i>
                    </div>
                    <h3 class="text-lg font-bold text-stone-800 dark:text-white mb-1">Không tìm thấy kỷ niệm phù hợp</h3>
                    <p class="text-sm text-stone-500 dark:text-stone-400 mb-6">
                        Hãy thử tải lên nội dung mới hoặc thay đổi bộ lọc tìm kiếm.
                    </p>
                    <button onclick="App.navigate('upload')" class="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition">
                        Tải ảnh & video lên
                    </button>
                </div>
            `;
        }

        return `
            <div class="masonry-grid">
                ${this.currentMemories.map((m, idx) => this.renderMemoryCard(m, idx)).join('')}
            </div>
        `;
    },

    renderMemoryCard(m, index) {
        const isVideo = m.file_type === 'video';
        const isFav = m.is_favorite == 1;
        const isSelected = this.selectedMemoryIds.has(m.id);

        return `
            <div class="masonry-item group relative glass rounded-3xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300" onclick="App.handleCardClick(event, ${index}, ${m.id})">
                <!-- Checkbox for Batch Mode -->
                <div class="batch-checkbox-wrap absolute top-3 left-3 z-20 ${this.batchMode ? '' : 'hidden'}">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="App.toggleSelectMemory(${m.id}, this.checked)" class="w-5 h-5 accent-purple-600 rounded cursor-pointer shadow-md">
                </div>

                <!-- Media Visual -->
                <div class="relative overflow-hidden bg-stone-100 dark:bg-stone-900">
                    ${isVideo ? `
                        <div class="relative w-full aspect-video bg-black flex items-center justify-center">
                            <video src="${m.file_path}#t=0.5" preload="metadata" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"></video>
                            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div class="w-12 h-12 rounded-full bg-white/30 backdrop-blur-md border border-white/50 text-white flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-600 transition duration-300 shadow-lg">
                                    <i data-lucide="play" class="w-6 h-6 fill-current ml-0.5"></i>
                                </div>
                            </div>
                            <span class="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-white text-[10px] font-semibold flex items-center gap-1">
                                <i data-lucide="film" class="w-3 h-3"></i> Video
                            </span>
                        </div>
                    ` : `
                        <img src="${m.file_path}" alt="${m.title}" loading="lazy" class="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-500">
                    `}

                    <!-- Hover Quick Actions (Top Right) -->
                    <div class="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                        <button onclick="event.stopPropagation(); App.toggleFavorite(${m.id})" class="p-2 rounded-full backdrop-blur-md ${isFav ? 'bg-rose-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'} transition shadow-sm">
                            <i data-lucide="heart" class="w-4 h-4 ${isFav ? 'fill-current' : ''}"></i>
                        </button>
                        <a href="api/download?id=${m.id}" onclick="event.stopPropagation()" class="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition shadow-sm">
                            <i data-lucide="download" class="w-4 h-4"></i>
                        </a>
                    </div>

                    <!-- Overlay Details at bottom -->
                    <div class="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <h4 class="font-bold text-sm truncate">${m.title}</h4>
                        <div class="flex items-center gap-2 text-[11px] text-stone-300 mt-1">
                            <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> ${m.memory_date}</span>
                            ${m.location ? `<span class="flex items-center gap-1 truncate"><i data-lucide="map-pin" class="w-3 h-3"></i> ${m.location}</span>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Card Body (visible on mobile / light) -->
                <div class="p-4 sm:hidden">
                    <h4 class="font-bold text-stone-900 dark:text-white text-sm truncate">${m.title}</h4>
                    <div class="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mt-1">
                        <span>${m.memory_date}</span>
                        ${m.album_title ? `<span class="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">${m.album_title}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    handleCardClick(event, index, id) {
        if (this.batchMode) {
            const isChecked = this.selectedMemoryIds.has(id);
            this.toggleSelectMemory(id, !isChecked);
            return;
        }
        this.openLightbox(index);
    },

    toggleBatchMode(force = null) {
        this.batchMode = force !== null ? force : !this.batchMode;
        const toolbar = document.getElementById('batch-toolbar');
        const checkboxes = document.querySelectorAll('.batch-checkbox-wrap');
        
        if (this.batchMode) {
            toolbar?.classList.remove('hidden');
            checkboxes.forEach(el => el.classList.remove('hidden'));
        } else {
            toolbar?.classList.add('hidden');
            checkboxes.forEach(el => el.classList.add('hidden'));
            this.selectedMemoryIds.clear();
        }
        this.updateBatchCount();
        if (window.lucide) lucide.createIcons();
    },

    toggleSelectMemory(id, isSelected) {
        if (isSelected) {
            this.selectedMemoryIds.add(id);
        } else {
            this.selectedMemoryIds.delete(id);
        }
        this.updateBatchCount();
    },

    selectAllMemories() {
        this.currentMemories.forEach(m => this.selectedMemoryIds.add(m.id));
        document.querySelectorAll('.batch-checkbox-wrap input[type="checkbox"]').forEach(cb => cb.checked = true);
        this.updateBatchCount();
    },

    updateBatchCount() {
        const countEl = document.getElementById('batch-count');
        if (countEl) countEl.textContent = this.selectedMemoryIds.size;
    },

    async batchDelete() {
        if (this.selectedMemoryIds.size === 0) {
            this.toast('Vui lòng chọn ít nhất một kỷ niệm', 'error');
            return;
        }
        if (!confirm(`Bạn có chắc chắn muốn xóa ${this.selectedMemoryIds.size} kỷ niệm đã chọn?`)) return;

        try {
            const res = await fetch('api/memories/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation: 'delete',
                    ids: Array.from(this.selectedMemoryIds)
                })
            });
            const data = await res.json();
            if (res.ok) {
                this.toast(data.message || 'Đã xóa thành công', 'success');
                this.toggleBatchMode(false);
                this.navigate(this.currentRoute, false);
            } else {
                this.toast(data.error || 'Có lỗi xảy ra', 'error');
            }
        } catch (e) {
            this.toast('Lỗi kết nối khi xóa', 'error');
        }
    },

    batchDownload() {
        if (this.selectedMemoryIds.size === 0) {
            this.toast('Vui lòng chọn ít nhất một kỷ niệm để tải về', 'error');
            return;
        }
        const ids = Array.from(this.selectedMemoryIds).join(',');
        window.location.href = `api/download?ids=${ids}`;
        this.toast('Đang tạo tệp nén Zip để tải xuống...', 'info');
    },

    async toggleFavorite(id) {
        try {
            const res = await fetch('api/memories/toggle_favorite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (res.ok) {
                this.toast(data.message, 'success');
                const mem = this.currentMemories.find(m => m.id == id);
                if (mem) mem.is_favorite = data.is_favorite;
                
                // Re-render grid or current view
                const container = document.getElementById('memories-container');
                if (container) {
                    container.innerHTML = this.renderMemoriesGrid();
                    if (window.lucide) lucide.createIcons();
                }
            }
        } catch (e) {
            console.error(e);
        }
    },

    // Lightbox & Video Player
    openLightbox(index) {
        this.lightboxIndex = index;
        const memory = this.currentMemories[index];
        if (!memory) return;

        const modal = document.getElementById('lightbox-modal');
        if (!modal) return;
        modal.classList.remove('hidden');

        this.renderLightboxContent(memory);
    },

    renderLightboxContent(memory) {
        const isVideo = memory.file_type === 'video';
        const isFav = memory.is_favorite == 1;
        const mediaContainer = document.getElementById('lightbox-media-container');
        const infoContainer = document.getElementById('lightbox-info-container');

        // Reset zoom
        this.zoomLevel = 1;

        if (isVideo) {
            mediaContainer.innerHTML = `
                <div class="relative w-full max-w-4xl max-h-[80vh] flex flex-col items-center justify-center">
                    <video id="custom-video-player" src="${memory.file_path}" controls autoplay class="w-full h-auto max-h-[75vh] rounded-2xl shadow-2xl bg-black">
                        Trình duyệt của bạn không hỗ trợ phát video.
                    </video>
                </div>
            `;
        } else {
            mediaContainer.innerHTML = `
                <div class="relative overflow-hidden flex items-center justify-center">
                    <img id="lightbox-zoom-target" src="${memory.file_path}" alt="${memory.title}" class="lightbox-img object-contain rounded-2xl shadow-2xl select-none" style="transform: scale(${this.zoomLevel});">
                </div>
            `;
        }

        infoContainer.innerHTML = `
            <div class="p-6 space-y-6">
                <!-- Header -->
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <span class="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${isVideo ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'} mb-2">
                            ${isVideo ? 'Video kỷ niệm' : 'Ảnh kỷ niệm'}
                        </span>
                        <h2 class="text-xl font-bold font-serif text-stone-900 dark:text-white">${memory.title}</h2>
                    </div>
                    <button onclick="App.toggleFavorite(${memory.id})" class="p-2.5 rounded-full ${isFav ? 'bg-rose-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'} transition">
                        <i data-lucide="heart" class="w-5 h-5 ${isFav ? 'fill-current' : ''}"></i>
                    </button>
                </div>

                <!-- Story / Description -->
                <div class="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/60">
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5 flex items-center gap-1.5">
                        <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Câu chuyện kỷ niệm
                    </h4>
                    <p class="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic">
                        "${memory.description || 'Khoảnh khắc đáng nhớ trong cuộc sống.'}"
                    </p>
                </div>

                <!-- Metadata Details -->
                <div class="space-y-3 text-xs text-stone-600 dark:text-stone-400">
                    <div class="flex items-center gap-3">
                        <div class="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
                            <i data-lucide="calendar" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <div class="text-[10px] text-stone-400">Ngày chụp / ghi lại</div>
                            <div class="font-semibold text-stone-800 dark:text-stone-200">${memory.memory_date}</div>
                        </div>
                    </div>

                    ${memory.location ? `
                        <div class="flex items-center gap-3">
                            <div class="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
                                <i data-lucide="map-pin" class="w-4 h-4"></i>
                            </div>
                            <div>
                                <div class="text-[10px] text-stone-400">Địa điểm</div>
                                <div class="font-semibold text-stone-800 dark:text-stone-200">${memory.location}</div>
                            </div>
                        </div>
                    ` : ''}

                    ${memory.album_title ? `
                        <div class="flex items-center gap-3">
                            <div class="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
                                <i data-lucide="folder" class="w-4 h-4"></i>
                            </div>
                            <div>
                                <div class="text-[10px] text-stone-400">Album</div>
                                <div class="font-semibold text-purple-600 dark:text-purple-400">${memory.album_title}</div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="flex items-center gap-3">
                        <div class="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
                            <i data-lucide="hard-drive" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <div class="text-[10px] text-stone-400">Dung lượng</div>
                            <div class="font-semibold text-stone-800 dark:text-stone-200">${memory.formatted_size || 'Đã tối ưu'}</div>
                        </div>
                    </div>
                </div>

                <!-- Tags -->
                ${memory.tags && memory.tags.length > 0 ? `
                    <div>
                        <div class="text-[11px] text-stone-400 uppercase font-semibold mb-2">Thẻ tag</div>
                        <div class="flex flex-wrap gap-1.5">
                            ${memory.tags.map(t => `<span class="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs">#${t.name}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Actions -->
                <div class="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2">
                    <a href="api/download?id=${memory.id}" class="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-1.5">
                        <i data-lucide="download" class="w-4 h-4"></i> Tải về máy
                    </a>
                    <button onclick="App.openEditModal(${memory.id})" class="p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="App.deleteMemory(${memory.id})" class="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
    },

    nextLightbox() {
        if (this.currentMemories.length === 0) return;
        this.lightboxIndex = (this.lightboxIndex + 1) % this.currentMemories.length;
        this.renderLightboxContent(this.currentMemories[this.lightboxIndex]);
    },

    prevLightbox() {
        if (this.currentMemories.length === 0) return;
        this.lightboxIndex = (this.lightboxIndex - 1 + this.currentMemories.length) % this.currentMemories.length;
        this.renderLightboxContent(this.currentMemories[this.lightboxIndex]);
    },

    zoomIn() {
        this.zoomLevel = Math.min(3, this.zoomLevel + 0.25);
        const target = document.getElementById('lightbox-zoom-target');
        if (target) target.style.transform = `scale(${this.zoomLevel})`;
    },

    zoomOut() {
        this.zoomLevel = Math.max(0.75, this.zoomLevel - 0.25);
        const target = document.getElementById('lightbox-zoom-target');
        if (target) target.style.transform = `scale(${this.zoomLevel})`;
    },

    closeLightbox() {
        const modal = document.getElementById('lightbox-modal');
        if (modal) modal.classList.add('hidden');
        // Stop any playing video
        const vid = document.getElementById('custom-video-player');
        if (vid) vid.pause();
    },

    // View: Albums
    async renderAlbumsView() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center p-12">
                <div class="inline-block animate-spin text-purple-600 text-3xl">◌</div>
            </div>
        `;

        try {
            const res = await fetch('api/albums');
            const data = await res.json();
            const albums = data.albums || [];

            container.innerHTML = `
                <div class="space-y-6 animate-fade-in pb-16">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 class="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-white">
                                Album của tôi
                            </h1>
                            <p class="text-stone-500 dark:text-stone-400 text-sm mt-0.5">
                                Tuyển tập các bộ sưu tập ảnh và video theo từng hành trình cuộc sống
                            </p>
                        </div>
                        <button onclick="App.openCreateAlbumModal()" class="px-5 py-2.5 rounded-2xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition flex items-center gap-2 shadow-sm">
                            <i data-lucide="folder-plus" class="w-4 h-4"></i>
                            <span>Tạo album mới</span>
                        </button>
                    </div>

                    ${albums.length > 0 ? `
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            ${albums.map(alb => `
                                <div onclick="App.navigate('album-detail:${alb.id}')" class="group glass rounded-3xl overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                                    <div class="relative h-48 overflow-hidden bg-stone-100 dark:bg-stone-900">
                                        <img src="${alb.cover_url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${alb.title}">
                                        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                                        <span class="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-stone-900/80 backdrop-blur-md text-[11px] font-semibold text-stone-800 dark:text-stone-200">
                                            ${alb.category || 'Bộ sưu tập'}
                                        </span>
                                        <div class="absolute bottom-3 left-3 right-3 text-white">
                                            <h3 class="font-bold text-base truncate">${alb.title}</h3>
                                            <div class="flex items-center gap-3 text-xs text-stone-200 mt-1">
                                                <span>${alb.total_photos || 0} ảnh</span>
                                                <span>•</span>
                                                <span>${alb.total_videos || 0} video</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="p-4 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                                        <span class="truncate">${alb.description || 'Không có mô tả'}</span>
                                        <i data-lucide="chevron-right" class="w-4 h-4 flex-shrink-0 text-stone-400 group-hover:translate-x-1 transition-transform"></i>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="glass p-16 rounded-3xl text-center">
                            <div class="w-16 h-16 mx-auto rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                                <i data-lucide="folder-heart" class="w-8 h-8"></i>
                            </div>
                            <h3 class="text-lg font-bold text-stone-800 dark:text-white mb-1">Chưa có album nào</h3>
                            <p class="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-sm mx-auto">
                                Hãy gom các kỷ niệm lại thành những câu chuyện đặc biệt: Gia đình, Bạn bè, Du lịch, v.v.
                            </p>
                            <button onclick="App.openCreateAlbumModal()" class="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition">
                                Tạo album đầu tiên
                            </button>
                        </div>
                    `}
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="p-8 text-rose-500">Lỗi khi tải danh sách album.</div>`;
        }
    },

    // View: Album Details
    async renderAlbumDetailView(albumId) {
        if (!albumId) {
            this.navigate('albums');
            return;
        }

        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center p-12">
                <div class="inline-block animate-spin text-purple-600 text-3xl">◌</div>
            </div>
        `;

        try {
            const res = await fetch(`api/albums/${albumId}`);
            const data = await res.json();
            const album = data.album;
            this.currentMemories = album.memories || [];
            this.activeAlbumId = albumId;

            container.innerHTML = `
                <div class="space-y-8 animate-fade-in pb-16">
                    <!-- Album Hero Banner -->
                    <div class="relative overflow-hidden rounded-3xl h-64 sm:h-80 shadow-lg">
                        <img src="${album.cover_url}" class="w-full h-full object-cover" alt="${album.title}">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 backdrop-blur-[2px]"></div>
                        
                        <div class="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                            <div>
                                <button onclick="App.navigate('albums')" class="inline-flex items-center gap-1 text-xs font-semibold text-stone-300 hover:text-white mb-3">
                                    <i data-lucide="arrow-left" class="w-4 h-4"></i> Quay lại Albums
                                </button>
                                <span class="block text-xs font-bold uppercase tracking-wider text-purple-300 mb-1">
                                    ${album.category || 'Album'}
                                </span>
                                <h1 class="text-2xl sm:text-4xl font-bold font-serif mb-2">${album.title}</h1>
                                <p class="text-sm text-stone-200 max-w-xl">${album.description || 'Bộ sưu tập kỷ niệm đáng nhớ.'}</p>
                            </div>

                            <div class="flex items-center gap-2">
                                <button onclick="App.navigate('upload')" class="px-4 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-xs hover:bg-purple-700 transition flex items-center gap-1.5 shadow-md">
                                    <i data-lucide="plus" class="w-4 h-4"></i> Thêm kỷ niệm
                                </button>
                                <button onclick="App.openEditAlbumModal(${album.id})" class="p-2.5 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition">
                                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                                </button>
                                <button onclick="App.deleteAlbum(${album.id})" class="p-2.5 rounded-xl bg-rose-600/80 backdrop-blur-md text-white hover:bg-rose-700 transition">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Album Memories Grid -->
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-xl font-bold font-serif text-stone-900 dark:text-white">
                                Kỷ niệm trong album (${this.currentMemories.length})
                            </h2>
                        </div>
                        <div id="memories-container">
                            ${this.renderMemoriesGrid()}
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="p-8 text-rose-500">Lỗi khi tải thông tin album.</div>`;
        }
    },

    // View: Timeline (Hành trình ký ức)
    async renderTimelineView() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center p-12">
                <div class="inline-block animate-spin text-purple-600 text-3xl">◌</div>
            </div>
        `;

        try {
            const res = await fetch('api/timeline');
            const data = await res.json();
            const timeline = data.timeline || [];
            const years = data.available_years || [];

            container.innerHTML = `
                <div class="space-y-8 animate-fade-in pb-16">
                    <!-- Title & Year Filter Bar -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 class="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-white">
                                Dòng thời gian kỷ niệm
                            </h1>
                            <p class="text-stone-500 dark:text-stone-400 text-sm mt-0.5">
                                Hành trình từng năm tháng lưu dấu những khoảnh khắc quý giá
                            </p>
                        </div>
                        
                        <!-- Sticky Year Tabs -->
                        <div class="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
                            <button onclick="App.filterTimelineYear('')" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 text-white shadow-sm">
                                Tất cả năm
                            </button>
                            ${years.map(y => `
                                <button onclick="App.filterTimelineYear('${y}')" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold glass text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition">
                                    ${y}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Timeline Vertical Progression -->
                    ${timeline.length > 0 ? `
                        <div class="relative space-y-12">
                            ${timeline.map(yearGroup => `
                                <div class="space-y-6">
                                    <!-- Year Sticky Badge -->
                                    <div class="flex items-center gap-3">
                                        <div class="px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold font-serif text-base shadow-md">
                                            Năm ${yearGroup.year}
                                        </div>
                                        <div class="h-0.5 flex-1 bg-gradient-to-r from-purple-300/50 to-transparent dark:from-purple-800/40"></div>
                                        <span class="text-xs font-medium text-stone-400">${yearGroup.total} khoảnh khắc</span>
                                    </div>

                                    <!-- Months in this year -->
                                    <div class="space-y-8 pl-4 border-l-2 border-purple-200 dark:border-purple-900/60 ml-4">
                                        ${yearGroup.months.map(mGroup => `
                                            <div class="relative space-y-4">
                                                <div class="flex items-center gap-2">
                                                    <span class="w-3 h-3 rounded-full bg-purple-600 border-2 border-white dark:border-stone-900 -ml-[23px]"></span>
                                                    <h3 class="text-base font-bold font-serif text-stone-800 dark:text-stone-200">
                                                        ${mGroup.month_name}
                                                    </h3>
                                                    <span class="text-xs text-stone-400">(${mGroup.total} kỷ niệm)</span>
                                                </div>

                                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    ${mGroup.items.map(m => `
                                                        <div onclick="App.openSingleMemoryModal(${m.id})" class="glass p-3 rounded-2xl cursor-pointer hover:shadow-lg transition-all group">
                                                            <div class="relative h-44 rounded-xl overflow-hidden mb-2 bg-stone-100 dark:bg-stone-800">
                                                                <img src="${m.file_path}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="${m.title}">
                                                                ${m.file_type === 'video' ? `
                                                                    <span class="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold">Video</span>
                                                                ` : ''}
                                                            </div>
                                                            <h4 class="font-bold text-stone-900 dark:text-white text-sm truncate">${m.title}</h4>
                                                            <div class="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mt-1">
                                                                <span>${m.memory_date}</span>
                                                                ${m.location ? `<span class="truncate ml-2 text-[11px]">${m.location}</span>` : ''}
                                                            </div>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="glass p-16 rounded-3xl text-center">
                            <h3 class="text-lg font-bold text-stone-800 dark:text-white mb-1">Chưa có dòng thời gian</h3>
                            <p class="text-sm text-stone-500 dark:text-stone-400 mb-4">Tải ảnh hoặc video kèm ngày chụp để hiển thị trên dòng thời gian.</p>
                            <button onclick="App.navigate('upload')" class="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm">Tải lên ngay</button>
                        </div>
                    `}
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="p-8 text-rose-500">Lỗi khi tải dòng thời gian.</div>`;
        }
    },

    async filterTimelineYear(year) {
        const container = document.getElementById('main-content');
        container.innerHTML = `<div class="p-12 text-center animate-spin text-purple-600 text-3xl">◌</div>`;
        try {
            const res = await fetch(`api/timeline${year ? '?year=' + year : ''}`);
            const data = await res.json();
            // Re-render
            this.renderTimelineView();
        } catch (e) {
            console.error(e);
        }
    },

    // View: On This Day (Kỷ niệm hôm nay)
    async renderOnThisDayView(reqDate = null) {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center p-12">
                <div class="inline-block animate-spin text-purple-600 text-3xl">◌</div>
            </div>
        `;

        try {
            let url = 'api/on-this-day';
            if (reqDate) url += `?date=${reqDate}`;

            const res = await fetch(url);
            const data = await res.json();
            const groups = data.groups || [];

            container.innerHTML = `
                <div class="space-y-8 animate-fade-in pb-16">
                    <!-- Nostalgic Header -->
                    <div class="relative overflow-hidden rounded-3xl p-8 glass bg-gradient-to-r from-purple-500/15 via-rose-500/10 to-amber-500/15 border border-purple-200/50 dark:border-purple-800/40">
                        <div class="max-w-2xl">
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 mb-3">
                                <i data-lucide="history" class="w-3.5 h-3.5"></i>
                                Vào ngày này năm trước...
                            </span>
                            <h1 class="text-3xl sm:text-4xl font-bold font-serif text-stone-900 dark:text-white mb-2">
                                Bạn còn nhớ ngày này không?
                            </h1>
                            <p class="text-stone-600 dark:text-stone-300 text-sm leading-relaxed">
                                Những khoảnh khắc từng trôi qua tưởng chừng như mới hôm qua. Hãy cùng lắng đọng và nhìn lại những nụ cười, những chuyến đi trên cùng một ngày của những năm trước.
                            </p>
                        </div>
                    </div>

                    <!-- Groups by Year Ago -->
                    ${data.has_memories ? `
                        <div class="space-y-10">
                            ${groups.map(g => `
                                <div class="space-y-4">
                                    <div class="flex items-center gap-3">
                                        <div class="px-4 py-1 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 font-bold text-sm">
                                            ${g.label}
                                        </div>
                                        <div class="h-px flex-1 bg-stone-200 dark:bg-stone-800"></div>
                                        <span class="text-xs text-stone-400">${g.memories.length} kỷ niệm</span>
                                    </div>

                                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        ${g.memories.map(m => `
                                            <div onclick="App.openSingleMemoryModal(${m.id})" class="glass rounded-3xl overflow-hidden cursor-pointer hover:shadow-xl transition-all group">
                                                <div class="relative h-56 bg-stone-100 dark:bg-stone-900 overflow-hidden">
                                                    <img src="${m.file_path}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${m.title}">
                                                    ${m.file_type === 'video' ? `
                                                        <div class="absolute inset-0 flex items-center justify-center">
                                                            <div class="w-12 h-12 rounded-full bg-black/40 text-white flex items-center justify-center"><i data-lucide="play" class="w-6 h-6 ml-0.5 fill-current"></i></div>
                                                        </div>
                                                    ` : ''}
                                                </div>
                                                <div class="p-5">
                                                    <h3 class="font-bold text-base text-stone-900 dark:text-white truncate">${m.title}</h3>
                                                    <p class="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1 italic">
                                                        "${m.description || 'Khoảnh khắc đáng nhớ.'}"
                                                    </p>
                                                    <div class="flex items-center justify-between text-xs text-stone-400 mt-3 pt-3 border-t border-stone-100 dark:border-stone-800">
                                                        <span>${m.memory_date}</span>
                                                        ${m.location ? `<span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> ${m.location}</span>` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="glass p-16 rounded-3xl text-center">
                            <div class="w-20 h-20 mx-auto rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mb-4">
                                <i data-lucide="sun-medium" class="w-10 h-10"></i>
                            </div>
                            <h3 class="text-xl font-bold font-serif text-stone-800 dark:text-white mb-2">Hôm nay chưa có kỷ niệm cũ nào</h3>
                            <p class="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-md mx-auto">
                                Hôm nay là một ngày tuyệt vời để tạo nên những ký ức mới! Hãy tải lên những bức ảnh, video của ngày hôm nay để nhìn lại vào năm sau bạn nhé.
                            </p>
                            <button onclick="App.navigate('upload')" class="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:shadow-lg transition">
                                Ghi lại khoảnh khắc hôm nay
                            </button>
                        </div>
                    `}
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="p-8 text-rose-500">Lỗi khi tải kỷ niệm ngày này năm xưa.</div>`;
        }
    },

    // View: Upload (Core Feature)
    async renderUploadView() {
        const container = document.getElementById('main-content');
        
        // Fetch albums for dropdown
        let albums = [];
        try {
            const res = await fetch('api/albums');
            const data = await res.json();
            albums = data.albums || [];
        } catch (e) {}

        container.innerHTML = `
            <div class="max-w-4xl mx-auto space-y-8 animate-fade-in pb-16">
                <div>
                    <h1 class="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-white">
                        Tải ảnh & video kỷ niệm
                    </h1>
                    <p class="text-stone-500 dark:text-stone-400 text-sm mt-0.5">
                        Lưu giữ an toàn những khoảnh khắc quý giá vào không gian số của bạn
                    </p>
                </div>

                <form id="upload-form" onsubmit="App.handleUploadSubmit(event)" class="space-y-6">
                    <!-- Drop Zone -->
                    <div id="drop-zone" class="relative glass rounded-3xl p-8 sm:p-12 text-center border-2 border-dashed border-purple-300 dark:border-purple-800 hover:border-purple-500 transition-all cursor-pointer bg-purple-50/20 dark:bg-purple-950/20">
                        <input type="file" id="upload-file-input" name="files[]" multiple accept="image/*,video/mp4,video/webm,video/quicktime" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onchange="App.handleFileSelection(event)">
                        
                        <div class="pointer-events-none space-y-3">
                            <div class="w-16 h-16 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                                <i data-lucide="upload-cloud" class="w-8 h-8"></i>
                            </div>
                            <h3 class="text-lg font-bold text-stone-800 dark:text-stone-100">
                                Kéo và thả ảnh hoặc video vào đây
                            </h3>
                            <p class="text-xs text-stone-500 dark:text-stone-400">
                                Hoặc <span class="text-purple-600 font-semibold underline">nhấn để duyệt file</span> từ thiết bị của bạn
                            </p>
                            <div class="flex items-center justify-center gap-2 text-[11px] text-stone-400 pt-2">
                                <span>Hỗ trợ: JPG, PNG, WEBP, GIF</span>
                                <span>•</span>
                                <span>Video: MP4, MOV, WEBM (Tối đa 100MB/file)</span>
                            </div>
                        </div>
                    </div>

                    <!-- File Queue Preview List -->
                    <div id="file-queue-preview" class="hidden space-y-3">
                        <div class="flex items-center justify-between text-xs font-semibold text-stone-600 dark:text-stone-400">
                            <span>Danh sách file đã chọn (<span id="queue-count">0</span>)</span>
                            <button type="button" onclick="App.clearFileQueue()" class="text-rose-500 hover:underline">Xóa tất cả</button>
                        </div>
                        <div id="queue-items-container" class="grid grid-cols-2 sm:grid-cols-4 gap-3"></div>
                    </div>

                    <!-- Metadata Fields Form -->
                    <div class="glass p-6 sm:p-8 rounded-3xl space-y-5">
                        <h3 class="text-base font-bold font-serif text-stone-900 dark:text-white border-b border-stone-200 dark:border-stone-800 pb-3">
                            Thông tin & Câu chuyện kỷ niệm
                        </h3>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Tên kỷ niệm</label>
                                <input type="text" name="title" placeholder="VD: Hoàng hôn trên biển, Lễ tốt nghiệp..." class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 text-sm outline-none focus:border-purple-500">
                            </div>

                            <div>
                                <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Ngày kỷ niệm (Ngày chụp/quay)</label>
                                <input type="date" name="memory_date" value="${new Date().toISOString().split('T')[0]}" class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 text-sm outline-none focus:border-purple-500">
                            </div>

                            <div>
                                <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Địa điểm</label>
                                <input type="text" name="location" placeholder="VD: Đà Lạt, Lâm Đồng" class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 text-sm outline-none focus:border-purple-500">
                            </div>

                            <div>
                                <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Lưu vào Album</label>
                                <select name="album_id" class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 text-sm outline-none focus:border-purple-500">
                                    <option value="">-- Không chọn album (Thư viện chung) --</option>
                                    ${albums.map(a => `<option value="${a.id}">${a.title}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Thẻ Tag (Cách nhau bằng dấu phẩy)</label>
                            <input type="text" name="tags" placeholder="Du lịch, Đà Lạt, Mùa hè, Bạn bè" class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 text-sm outline-none focus:border-purple-500">
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Câu chuyện / Cảm xúc</label>
                            <textarea name="description" rows="3" placeholder="Viết lại những cảm xúc và câu chuyện thú vị gắn liền với khoảnh khắc này..." class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 text-sm outline-none focus:border-purple-500"></textarea>
                        </div>
                    </div>

                    <!-- Upload Progress Bar (hidden by default) -->
                    <div id="upload-progress-card" class="hidden glass p-5 rounded-2xl space-y-2 border border-purple-300 dark:border-purple-800">
                        <div class="flex items-center justify-between text-xs font-bold text-stone-800 dark:text-stone-200">
                            <span id="progress-status-text">Đang tải lên các tệp...</span>
                            <span id="progress-percentage-text">0%</span>
                        </div>
                        <div class="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-2.5 overflow-hidden">
                            <div id="progress-bar-fill" class="bg-gradient-to-r from-purple-600 to-indigo-600 h-2.5 rounded-full transition-all duration-200" style="width: 0%"></div>
                        </div>
                    </div>

                    <!-- Submit Button -->
                    <div class="flex items-center justify-end gap-3">
                        <button type="button" onclick="App.navigate('dashboard')" class="px-5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-medium text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
                            Hủy bỏ
                        </button>
                        <button type="submit" id="btn-submit-upload" class="px-7 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition shadow-lg shadow-purple-500/20 flex items-center gap-2">
                            <i data-lucide="check" class="w-4 h-4"></i>
                            <span>Lưu kỷ niệm</span>
                        </button>
                    </div>
                </form>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    },

    uploadQueue: [],

    handleFileSelection(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        this.uploadQueue = files;

        const queueCard = document.getElementById('file-queue-preview');
        const queueCount = document.getElementById('queue-count');
        const container = document.getElementById('queue-items-container');

        queueCard?.classList.remove('hidden');
        if (queueCount) queueCount.textContent = files.length;

        if (container) {
            container.innerHTML = files.map((file, idx) => {
                const isVid = file.type.startsWith('video/');
                const previewUrl = URL.createObjectURL(file);
                const sizeFmt = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

                return `
                    <div class="relative glass rounded-xl overflow-hidden p-2 group text-xs">
                        <div class="w-full h-24 rounded-lg overflow-hidden bg-black/10 flex items-center justify-center mb-1.5">
                            ${isVid ? `
                                <div class="text-rose-500 flex flex-col items-center gap-1">
                                    <i data-lucide="film" class="w-6 h-6"></i>
                                    <span class="text-[10px] font-bold">Video</span>
                                </div>
                            ` : `
                                <img src="${previewUrl}" class="w-full h-full object-cover">
                            `}
                        </div>
                        <div class="font-semibold truncate text-stone-800 dark:text-stone-200">${file.name}</div>
                        <div class="text-[10px] text-stone-400">${sizeFmt}</div>
                    </div>
                `;
            }).join('');
            if (window.lucide) lucide.createIcons();
        }
    },

    clearFileQueue() {
        this.uploadQueue = [];
        const input = document.getElementById('upload-file-input');
        if (input) input.value = '';
        document.getElementById('file-queue-preview')?.classList.add('hidden');
    },

    async handleUploadSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = document.getElementById('btn-submit-upload');
        const progressCard = document.getElementById('upload-progress-card');
        const progressBar = document.getElementById('progress-bar-fill');
        const progressPercent = document.getElementById('progress-percentage-text');
        const progressStatus = document.getElementById('progress-status-text');

        if (this.uploadQueue.length === 0) {
            this.toast('Vui lòng chọn ít nhất một hình ảnh hoặc video để tải lên.', 'error');
            return;
        }

        const formData = new FormData();
        this.uploadQueue.forEach(file => {
            formData.append('files[]', file);
        });
        formData.append('title', form.title.value);
        formData.append('memory_date', form.memory_date.value);
        formData.append('location', form.location.value);
        formData.append('album_id', form.album_id.value);
        formData.append('tags', form.tags.value);
        formData.append('description', form.description.value);

        submitBtn.disabled = true;
        progressCard?.classList.remove('hidden');

        // Simulate progress bar smoothly while uploading
        let progress = 10;
        const interval = setInterval(() => {
            progress = Math.min(90, progress + 15);
            if (progressBar) progressBar.style.width = progress + '%';
            if (progressPercent) progressPercent.textContent = progress + '%';
        }, 150);

        try {
            const res = await fetch('api/memories', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            clearInterval(interval);

            if (res.ok) {
                if (progressBar) progressBar.style.width = '100%';
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressStatus) progressStatus.textContent = 'Hoàn tất lưu trữ!';

                this.toast(data.message || 'Tải lên thành công!', 'success');
                setTimeout(() => {
                    this.navigate('all-memories');
                }, 800);
            } else {
                this.toast(data.error || 'Tải lên thất bại', 'error');
            }
        } catch (err) {
            clearInterval(interval);
            this.toast('Lỗi kết nối khi tải tệp lên', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    },

    // View: Profile
    async renderProfileView() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="max-w-3xl mx-auto space-y-8 animate-fade-in pb-16">
                <div>
                    <h1 class="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-white">
                        Hồ sơ cá nhân
                    </h1>
                    <p class="text-stone-500 dark:text-stone-400 text-sm mt-0.5">
                        Quản lý thông tin tài khoản và không gian lưu trữ của bạn
                    </p>
                </div>

                <div class="glass p-6 sm:p-8 rounded-3xl space-y-6">
                    <form onsubmit="App.handleProfileUpdate(event)" class="space-y-6">
                        <!-- Avatar Section -->
                        <div class="flex items-center gap-6">
                            <div class="relative w-24 h-24 rounded-full overflow-hidden border-2 border-purple-500 shadow-md">
                                <img id="profile-avatar-preview" src="${this.user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80'}" class="w-full h-full object-cover">
                            </div>
                            <div>
                                <label class="px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100 cursor-pointer transition">
                                    <span>Thay đổi ảnh đại diện</span>
                                    <input type="file" name="avatar_file" accept="image/*" class="hidden" onchange="App.previewAvatar(event)">
                                </label>
                                <p class="text-[11px] text-stone-400 mt-2">Hỗ trợ JPG, PNG, WEBP tối đa 5MB</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Họ và tên</label>
                                <input type="text" name="full_name" value="${this.user.full_name || ''}" class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 outline-none">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Tên đăng nhập</label>
                                <input type="text" value="${this.user.username}" disabled class="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 text-sm text-stone-500 cursor-not-allowed">
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Email</label>
                            <input type="email" value="${this.user.email}" disabled class="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 text-sm text-stone-500 cursor-not-allowed">
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Giới thiệu bản thân (Bio)</label>
                            <textarea name="bio" rows="3" class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 outline-none">${this.user.bio || ''}</textarea>
                        </div>

                        <div class="flex justify-end">
                            <button type="submit" class="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition">
                                Lưu thay đổi
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Password Change Box -->
                <div class="glass p-6 sm:p-8 rounded-3xl space-y-4">
                    <h3 class="text-base font-bold font-serif text-stone-900 dark:text-white">Đổi mật khẩu</h3>
                    <form onsubmit="App.handleChangePassword(event)" class="space-y-4">
                        <div>
                            <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Mật khẩu hiện tại</label>
                            <input type="password" name="current_password" required class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm outline-none">
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Mật khẩu mới</label>
                                <input type="password" name="new_password" required class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm outline-none">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Xác nhận mật khẩu mới</label>
                                <input type="password" name="confirm_password" required class="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm outline-none">
                            </div>
                        </div>
                        <div class="flex justify-end">
                            <button type="submit" class="px-5 py-2.5 rounded-xl border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 text-sm font-semibold hover:bg-purple-50 dark:hover:bg-purple-950/40">
                                Cập nhật mật khẩu
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    previewAvatar(e) {
        const file = e.target.files[0];
        if (!file) return;
        const target = document.getElementById('profile-avatar-preview');
        if (target) target.src = URL.createObjectURL(file);
    },

    async handleProfileUpdate(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        try {
            const res = await fetch('api/auth/update_profile', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                this.user = data.user;
                this.toast('Cập nhật hồ sơ thành công!', 'success');
                this.renderUserUI();
            } else {
                this.toast(data.error || 'Cập nhật thất bại', 'error');
            }
        } catch (err) {
            this.toast('Lỗi kết nối máy chủ', 'error');
        }
    },

    async handleChangePassword(e) {
        e.preventDefault();
        const form = e.target;
        const current_password = form.current_password.value;
        const new_password = form.new_password.value;
        const confirm_password = form.confirm_password.value;

        if (new_password !== confirm_password) {
            this.toast('Mật khẩu mới không trùng khớp!', 'error');
            return;
        }

        try {
            const res = await fetch('api/auth/change_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password, new_password, confirm_password })
            });
            const data = await res.json();
            if (res.ok) {
                this.toast('Đổi mật khẩu thành công!', 'success');
                form.reset();
            } else {
                this.toast(data.error || 'Đổi mật khẩu thất bại', 'error');
            }
        } catch (err) {
            this.toast('Lỗi kết nối máy chủ', 'error');
        }
    },

    // View: Settings
    renderSettingsView() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="max-w-3xl mx-auto space-y-8 animate-fade-in pb-16">
                <div>
                    <h1 class="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-white">
                        Cài đặt hệ thống
                    </h1>
                    <p class="text-stone-500 dark:text-stone-400 text-sm mt-0.5">
                        Tùy chỉnh giao diện, quyền riêng tư và dọn dẹp dung lượng lưu trữ
                    </p>
                </div>

                <!-- Appearance -->
                <div class="glass p-6 sm:p-8 rounded-3xl space-y-4">
                    <h3 class="text-base font-bold font-serif text-stone-900 dark:text-white">Giao diện</h3>
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-semibold text-sm text-stone-800 dark:text-stone-200">Chế độ giao diện (Dark / Light Mode)</div>
                            <div class="text-xs text-stone-400">Chuyển đổi giữa chế độ nền sáng và nền tối êm dịu cho mắt</div>
                        </div>
                        <button onclick="App.toggleTheme()" class="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold flex items-center gap-2 hover:bg-stone-100 dark:hover:bg-stone-800">
                            <i data-lucide="${this.theme === 'dark' ? 'sun' : 'moon'}" class="w-4 h-4 text-purple-600"></i>
                            <span>${this.theme === 'dark' ? 'Chế độ Sáng' : 'Chế độ Tối'}</span>
                        </button>
                    </div>
                </div>

                <!-- Storage Cleanup -->
                <div class="glass p-6 sm:p-8 rounded-3xl space-y-4">
                    <h3 class="text-base font-bold font-serif text-stone-900 dark:text-white">Quản lý dung lượng</h3>
                    <p class="text-xs text-stone-500">Mỗi tài khoản được cấp tối đa 20GB dung lượng lưu trữ tiêu chuẩn.</p>
                    <button onclick="App.navigate('all-memories')" class="px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100">
                        Kiểm tra các tệp lớn trong thư viện
                    </button>
                </div>

                <!-- Security & Sessions -->
                <div class="glass p-6 sm:p-8 rounded-3xl space-y-4">
                    <h3 class="text-base font-bold font-serif text-stone-900 dark:text-white">Bảo mật & Phiên đăng nhập</h3>
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-semibold text-sm text-stone-800 dark:text-stone-200">Đăng xuất khỏi thiết bị này</div>
                            <div class="text-xs text-stone-400">Kết thúc phiên làm việc hiện tại trên trình duyệt</div>
                        </div>
                        <button onclick="App.handleLogout()" class="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-xs font-semibold hover:bg-rose-100">
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    },

    // View: Admin Dashboard
    async renderAdminView() {
        if (!this.user || this.user.role !== 'admin') {
            this.navigate('dashboard');
            return;
        }

        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="flex items-center justify-center p-12">
                <div class="inline-block animate-spin text-purple-600 text-3xl">◌</div>
            </div>
        `;

        try {
            const resOverview = await fetch('api/admin/overview');
            const dataOverview = await resOverview.json();

            const resUsers = await fetch('api/admin/users');
            const dataUsers = await resUsers.json();

            const stats = dataOverview.stats;
            const users = dataUsers.users || [];
            const logs = dataOverview.recent_logs || [];

            container.innerHTML = `
                <div class="space-y-8 animate-fade-in pb-16">
                    <div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            Khu vực Quản Trị Viên (Admin)
                        </span>
                        <h1 class="text-2xl sm:text-3xl font-bold font-serif text-stone-900 dark:text-white mt-2">
                            Bảng điều khiển hệ thống
                        </h1>
                    </div>

                    <!-- Metrics -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="glass p-5 rounded-2xl">
                            <span class="text-xs text-stone-400">Tổng tài khoản</span>
                            <div class="text-2xl font-bold font-serif text-stone-900 dark:text-white mt-1">${stats.total_users}</div>
                            <div class="text-[11px] text-emerald-500 mt-1">${stats.active_users} đang hoạt động</div>
                        </div>
                        <div class="glass p-5 rounded-2xl">
                            <span class="text-xs text-stone-400">Tổng dung lượng lưu trữ</span>
                            <div class="text-2xl font-bold font-serif text-stone-900 dark:text-white mt-1">${stats.formatted_storage}</div>
                            <div class="text-[11px] text-purple-500 mt-1">Đã dùng trên hệ thống</div>
                        </div>
                        <div class="glass p-5 rounded-2xl">
                            <span class="text-xs text-stone-400">Tổng số ảnh</span>
                            <div class="text-2xl font-bold font-serif text-stone-900 dark:text-white mt-1">${stats.total_photos}</div>
                        </div>
                        <div class="glass p-5 rounded-2xl">
                            <span class="text-xs text-stone-400">Tổng số video</span>
                            <div class="text-2xl font-bold font-serif text-stone-900 dark:text-white mt-1">${stats.total_videos}</div>
                        </div>
                    </div>

                    <!-- User Management Table -->
                    <div class="glass rounded-3xl overflow-hidden shadow-sm">
                        <div class="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                            <h3 class="font-bold font-serif text-base text-stone-900 dark:text-white">Danh sách người dùng</h3>
                            <span class="text-xs text-stone-400">${users.length} tài khoản</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs text-stone-600 dark:text-stone-300">
                                <thead class="bg-stone-50 dark:bg-stone-800/50 uppercase text-[10px] text-stone-400">
                                    <tr>
                                        <th class="p-3 pl-5">Người dùng</th>
                                        <th class="p-3">Email</th>
                                        <th class="p-3">Vai trò</th>
                                        <th class="p-3">Dung lượng</th>
                                        <th class="p-3">Trạng thái</th>
                                        <th class="p-3 pr-5 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-stone-100 dark:divide-stone-800">
                                    ${users.map(u => `
                                        <tr class="hover:bg-stone-50/50 dark:hover:bg-stone-800/30">
                                            <td class="p-3 pl-5 flex items-center gap-3">
                                                <img src="${u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80'}" class="w-8 h-8 rounded-full object-cover">
                                                <div>
                                                    <div class="font-bold text-stone-800 dark:text-stone-100">${u.full_name}</div>
                                                    <div class="text-[10px] text-stone-400">@${u.username}</div>
                                                </div>
                                            </td>
                                            <td class="p-3">${u.email}</td>
                                            <td class="p-3">
                                                <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-stone-100 text-stone-600'}">
                                                    ${u.role}
                                                </span>
                                            </td>
                                            <td class="p-3">${u.formatted_used_storage}</td>
                                            <td class="p-3">
                                                <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                                                    ${u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                                                </span>
                                            </td>
                                            <td class="p-3 pr-5 text-right">
                                                ${u.role !== 'admin' ? `
                                                    <button onclick="App.toggleUserStatus(${u.id})" class="px-3 py-1 rounded-lg text-xs font-semibold ${u.status === 'active' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}">
                                                        ${u.status === 'active' ? 'Khóa' : 'Mở khóa'}
                                                    </button>
                                                ` : '<span class="text-stone-400 text-[11px]">Bảo vệ</span>'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- System Activity Logs -->
                    <div class="glass p-6 rounded-3xl space-y-4">
                        <h3 class="font-bold font-serif text-base text-stone-900 dark:text-white">Nhật ký hoạt động hệ thống</h3>
                        <div class="space-y-2">
                            ${logs.map(l => `
                                <div class="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 flex items-center justify-between text-xs">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-purple-600 dark:text-purple-400">[${l.action}]</span>
                                        <span class="text-stone-700 dark:text-stone-300">${l.details || 'Không có chi tiết'}</span>
                                    </div>
                                    <div class="text-[11px] text-stone-400">${l.created_at}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="p-8 text-rose-500">Lỗi khi tải trang quản trị.</div>`;
        }
    },

    async toggleUserStatus(userId) {
        try {
            const res = await fetch('api/admin/toggle_user_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await res.json();
            if (res.ok) {
                this.toast(data.message, 'success');
                this.renderAdminView();
            } else {
                this.toast(data.error || 'Có lỗi xảy ra', 'error');
            }
        } catch (e) {
            this.toast('Lỗi kết nối máy chủ', 'error');
        }
    },

    // Search Page View
    async renderSearchView() {
        const query = document.getElementById('global-search-input')?.value || '';
        this.renderMemoriesView({ title: `Kết quả tìm kiếm cho: "${query}"` });
    },

    handleGlobalSearch(e) {
        if (e.key === 'Enter') {
            const val = e.target.value.trim();
            if (val) {
                this.renderMemoriesView({ title: `Kết quả tìm kiếm cho "${val}"` });
            }
        }
    },

    // Toast Notifications
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `p-4 rounded-2xl glass shadow-2xl flex items-center gap-3 text-xs font-semibold transform transition-all duration-300 translate-y-4 opacity-0 border ${
            type === 'success' ? 'border-emerald-500/50 bg-emerald-50/90 text-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-200' :
            type === 'error' ? 'border-rose-500/50 bg-rose-50/90 text-rose-900 dark:bg-rose-950/90 dark:text-rose-200' :
            'border-purple-500/50 bg-purple-50/90 text-purple-900 dark:bg-purple-950/90 dark:text-purple-200'
        }`;

        toast.innerHTML = `
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // Create Album Modal
    openCreateAlbumModal() {
        const modal = document.getElementById('album-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeAlbumModal() {
        const modal = document.getElementById('album-modal');
        if (modal) modal.classList.add('hidden');
    },

    async handleCreateAlbum(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        try {
            const res = await fetch('api/albums', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                this.toast('Tạo album thành công!', 'success');
                this.closeAlbumModal();
                form.reset();
                this.renderAlbumsView();
            } else {
                this.toast(data.error || 'Tạo album thất bại', 'error');
            }
        } catch (err) {
            this.toast('Lỗi kết nối máy chủ', 'error');
        }
    },

    async deleteAlbum(albumId) {
        if (!confirm('Bạn có chắc chắn muốn xóa album này? (Các ảnh và video bên trong vẫn sẽ được giữ an toàn trong thư viện)')) return;
        try {
            const res = await fetch('api/albums/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: albumId })
            });
            const data = await res.json();
            if (res.ok) {
                this.toast(data.message, 'success');
                this.navigate('albums');
            }
        } catch (e) {
            this.toast('Lỗi khi xóa album', 'error');
        }
    },

    async deleteMemory(memoryId) {
        if (!confirm('Bạn có chắc chắn muốn xóa kỷ niệm này vĩnh viễn?')) return;
        try {
            const res = await fetch('api/memories/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: memoryId })
            });
            const data = await res.json();
            if (res.ok) {
                this.toast(data.message, 'success');
                this.closeLightbox();
                this.navigate(this.currentRoute, false);
            }
        } catch (e) {
            this.toast('Lỗi khi xóa kỷ niệm', 'error');
        }
    },

    async openSingleMemoryModal(id) {
        try {
            const res = await fetch(`api/memories/${id}`);
            const data = await res.json();
            if (data.memory) {
                // If not in currentMemories, add it
                const existingIdx = this.currentMemories.findIndex(m => m.id == id);
                if (existingIdx !== -1) {
                    this.openLightbox(existingIdx);
                } else {
                    this.currentMemories.push(data.memory);
                    this.openLightbox(this.currentMemories.length - 1);
                }
            }
        } catch (e) {
            console.error(e);
        }
    },

    async openEditModal(memoryId) {
        try {
            const res = await fetch(`api/memories/${memoryId}`);
            const data = await res.json();
            const memory = data.memory;
            if (!memory) return;

            document.getElementById('edit-memory-id').value = memory.id;
            document.getElementById('edit-memory-title').value = memory.title;
            document.getElementById('edit-memory-date').value = memory.memory_date;
            document.getElementById('edit-memory-location').value = memory.location || '';
            document.getElementById('edit-memory-description').value = memory.description || '';
            document.getElementById('edit-memory-tags').value = (memory.tags || []).map(t => t.name).join(', ');

            // Populate albums dropdown
            const albumSelect = document.getElementById('edit-memory-album');
            const resAlbums = await fetch('api/albums');
            const dataAlbums = await resAlbums.json();
            const albums = dataAlbums.albums || [];

            albumSelect.innerHTML = `<option value="">-- Không có album --</option>` + 
                albums.map(a => `<option value="${a.id}" ${a.id == memory.album_id ? 'selected' : ''}>${a.title}</option>`).join('');

            document.getElementById('edit-memory-modal')?.classList.remove('hidden');
        } catch (e) {
            this.toast('Lỗi khi mở form chỉnh sửa', 'error');
        }
    },

    closeEditMemoryModal() {
        document.getElementById('edit-memory-modal')?.classList.add('hidden');
    },

    async handleUpdateMemory(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.id.value;
        const title = form.title.value;
        const memory_date = form.memory_date.value;
        const location = form.location.value;
        const album_id = form.album_id.value;
        const tags = form.tags.value;
        const description = form.description.value;

        try {
            const res = await fetch('api/memories/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, title, memory_date, location, album_id, tags, description })
            });
            const data = await res.json();
            if (res.ok) {
                this.toast('Cập nhật kỷ niệm thành công!', 'success');
                this.closeEditMemoryModal();
                this.closeLightbox();
                this.navigate(this.currentRoute, false);
            } else {
                this.toast(data.error || 'Cập nhật thất bại', 'error');
            }
        } catch (err) {
            this.toast('Lỗi kết nối máy chủ', 'error');
        }
    },

    openEditAlbumModal(albumId) {
        // Can be expanded or prompt for rename
        const newTitle = prompt('Nhập tên mới cho album:');
        if (!newTitle) return;
        fetch('api/albums/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: albumId, title: newTitle })
        }).then(r => r.json()).then(data => {
            this.toast('Đã cập nhật album!', 'success');
            this.renderAlbumDetailView(albumId);
        });
    },

    bindEvents() {
        // Keyboard controls for Lightbox
        window.addEventListener('keydown', (e) => {
            const modal = document.getElementById('lightbox-modal');
            if (modal && !modal.classList.contains('hidden')) {
                if (e.key === 'Escape') this.closeLightbox();
                if (e.key === 'ArrowRight') this.nextLightbox();
                if (e.key === 'ArrowLeft') this.prevLightbox();
            }
        });
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
