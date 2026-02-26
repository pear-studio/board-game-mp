// pages/wordbank-settings/index.js
const { CATEGORIES, DEFAULT_SELECTED } = require('../../data/wordbank');

const STORAGE_KEY_CATEGORIES = 'wordbank_selected_categories';
const STORAGE_KEY_SUBSCRIPTIONS = 'wordbank_subscriptions';

const DIFFICULTY_LABEL = { easy: '简单', medium: '中等', hard: '困难' };
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

Page({
  data: {
    // 按难度分组的展示数据
    groups: [],
    // 已选中的分类 id 集合
    selectedIds: [],
    // 订阅的自定义词库列表
    subscriptions: [],
    // 输入框：分享码
    inputShareCode: '',
    // 状态
    loading: false,
    toast: '',
    // 词条预览弹窗
    showWordsModal: false,
    previewSub: {},

    // 自定义导航栏
    statusBarHeight: 0,
    navBarHeight: 44,
    navRightPadding: 100,
  },

  onLoad() {
    const { statusBarHeight } = wx.getSystemInfoSync();
    const menuBtn = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
    const navRightPadding = wx.getSystemInfoSync().windowWidth - menuBtn.left + 8;
    this.setData({ statusBarHeight, navBarHeight, navRightPadding });
    this._loadData();
  },

  // 每次页面显示时刷新（从创建页返回后能立即看到新词库）
  onShow() {
    this._loadData();
  },

  _loadData() {
    // 加载已选分类
    let selectedIds = wx.getStorageSync(STORAGE_KEY_CATEGORIES);
    if (!selectedIds || !selectedIds.length) {
      selectedIds = [...DEFAULT_SELECTED];
      wx.setStorageSync(STORAGE_KEY_CATEGORIES, selectedIds);
    }

    // 加载订阅词库，注入 checked 字段
    const rawSubs = wx.getStorageSync(STORAGE_KEY_SUBSCRIPTIONS) || [];
    const subscriptions = rawSubs.map(s => ({ ...s, checked: selectedIds.includes(s.id) }));

    // 构建分组展示数据
    const groups = DIFFICULTY_ORDER.map(diff => ({
      difficulty: diff,
      label: DIFFICULTY_LABEL[diff],
      categories: CATEGORIES
        .filter(c => c.difficulty === diff)
        .map(c => ({
          ...c,
          checked: selectedIds.includes(c.id),
        })),
    }));

    this.setData({ selectedIds, subscriptions, groups });
  },

  // 同步更新 subscriptions 里每项的 checked 字段
  _refreshSubscriptionChecked(selectedIds) {
    const subscriptions = this.data.subscriptions.map(s => ({
      ...s,
      checked: selectedIds.includes(s.id),
    }));
    this.setData({ subscriptions });
  },

  // ─── 切换内置分类勾选 ───────────────────────────────────
  toggleCategory(e) {
    const { id } = e.currentTarget.dataset;
    let { selectedIds } = this.data;
    const idx = selectedIds.indexOf(id);
    if (idx >= 0) {
      selectedIds = selectedIds.filter(x => x !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
    this._saveAndRefresh(selectedIds);
  },

  // ─── 全选/全不选某个难度组 ───────────────────────────────
  toggleGroup(e) {
    const { difficulty } = e.currentTarget.dataset;
    let { selectedIds } = this.data;
    const groupIds = CATEGORIES.filter(c => c.difficulty === difficulty).map(c => c.id);
    const allSelected = groupIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      selectedIds = selectedIds.filter(id => !groupIds.includes(id));
    } else {
      const toAdd = groupIds.filter(id => !selectedIds.includes(id));
      selectedIds = [...selectedIds, ...toAdd];
    }
    this._saveAndRefresh(selectedIds);
  },

  _saveAndRefresh(selectedIds) {
    wx.setStorageSync(STORAGE_KEY_CATEGORIES, selectedIds);
    const groups = DIFFICULTY_ORDER.map(diff => ({
      difficulty: diff,
      label: DIFFICULTY_LABEL[diff],
      categories: CATEGORIES
        .filter(c => c.difficulty === diff)
        .map(c => ({
          ...c,
          checked: selectedIds.includes(c.id),
        })),
    }));
    this.setData({ selectedIds, groups });
  },

  // ─── 订阅词库：输入分享码 ────────────────────────────────
  onShareCodeInput(e) {
    this.setData({ inputShareCode: e.detail.value.toUpperCase() });
  },

  subscribeByCode() {
    const code = this.data.inputShareCode.trim().toUpperCase();
    if (code.length < 6) {
      this._showToast('请输入6位分享码');
      return;
    }
    // 检查是否已订阅
    const exists = this.data.subscriptions.find(s => s.shareCode === code);
    if (exists) {
      this._showToast('已订阅该词库');
      return;
    }
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'wordbankGet',
      config: { env: 'board-game-6g6bcx73f538cbd0' },
      data: { shareCode: code },
    }).then(res => {
      const { wordbank } = res.result || {};
      if (!wordbank) {
        this._showToast('未找到该分享码对应的词库');
        this.setData({ loading: false });
        return;
      }
      const subs = [...this.data.subscriptions, {
        id: wordbank._id,
        name: wordbank.name,
        shareCode: code,
        words: wordbank.words,
        wordCount: (wordbank.words || []).length,
        subscribedAt: Date.now(),
      }];
      wx.setStorageSync(STORAGE_KEY_SUBSCRIPTIONS, subs);

      // 自动勾选该订阅
      const newSelectedIds = [...this.data.selectedIds, wordbank._id];
      wx.setStorageSync(STORAGE_KEY_CATEGORIES, newSelectedIds);

      this.setData({
        subscriptions: subs,
        selectedIds: newSelectedIds,
        inputShareCode: '',
        loading: false,
      });
      this._showToast(`已订阅「${wordbank.name}」✓`);
    }).catch(() => {
      this._showToast('订阅失败，请检查网络');
      this.setData({ loading: false });
    });
  },

  // ─── 取消订阅 ────────────────────────────────────────────
  unsubscribe(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '取消订阅',
      content: '确定取消该自定义词库？',
      confirmColor: '#e94560',
      success: ({ confirm }) => {
        if (!confirm) return;
        const subs = this.data.subscriptions.filter(s => s.id !== id);
        const selectedIds = this.data.selectedIds.filter(x => x !== id);
        wx.setStorageSync(STORAGE_KEY_SUBSCRIPTIONS, subs);
        wx.setStorageSync(STORAGE_KEY_CATEGORIES, selectedIds);
        this.setData({ subscriptions: subs, selectedIds });
        this._showToast('已取消订阅');
      },
    });
  },

  // ─── 切换订阅词库的启用状态 ─────────────────────────────
  toggleSubscription(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    let { selectedIds } = this.data;
    const idx = selectedIds.indexOf(id);
    if (idx >= 0) {
      selectedIds = selectedIds.filter(x => x !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
    wx.setStorageSync(STORAGE_KEY_CATEGORIES, selectedIds);
    this.setData({ selectedIds });
    // 同步刷新 subscriptions 的 checked 字段，确保 UI 响应
    this._refreshSubscriptionChecked(selectedIds);
  },

  // ─── 预览词条弹窗（自定义词库）──────────────────────────
  previewWords(e) {
    const { index } = e.currentTarget.dataset;
    const sub = this.data.subscriptions[index];
    if (!sub) return;
    this.setData({ showWordsModal: true, previewSub: sub });
  },

  // ─── 预览词条弹窗（内置分类）────────────────────────────
  previewBuiltin(e) {
    const { id } = e.currentTarget.dataset;
    const { CATEGORIES } = require('../../data/wordbank');
    const cat = CATEGORIES.find(c => c.id === id);
    if (!cat) return;
    this.setData({
      showWordsModal: true,
      previewSub: {
        name: cat.name,
        words: cat.words,
        wordCount: cat.words.length,
        shareCode: '', // 内置分类无分享码，弹窗 footer 不显示
      },
    });
  },

  closeWordsModal() {
    this.setData({ showWordsModal: false, previewSub: {} });
  },

  copyCodeFromModal() {
    const code = this.data.previewSub.shareCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => this._showToast(`分享码 ${code} 已复制 ✓`),
    });
  },

  // ─── 从弹窗删除订阅 ──────────────────────────────────────
  unsubscribeFromModal() {
    const id = this.data.previewSub.id;
    if (!id) return;
    wx.showModal({
      title: '取消订阅',
      content: '确定删除该自定义词库？',
      confirmColor: '#e94560',
      success: ({ confirm }) => {
        if (!confirm) return;
        const subs = this.data.subscriptions.filter(s => s.id !== id);
        const selectedIds = this.data.selectedIds.filter(x => x !== id);
        wx.setStorageSync('wordbank_subscriptions', subs);
        wx.setStorageSync('wordbank_selected_categories', selectedIds);
        this.setData({ subscriptions: subs, selectedIds, showWordsModal: false, previewSub: {} });
        this._showToast('已删除');
      },
    });
  },

  // ─── 创建自定义词库 ──────────────────────────────────────
  goCreateWordbank() {
    wx.navigateTo({ url: '/pages/custom-wordbank/index' });
  },

  // ─── 工具方法 ─────────────────────────────────────────────
  _showToast(text) {
    this.setData({ toast: text });
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.setData({ toast: '' });
    }, 2500);
  },

  // 计算总词数（用于展示）
  get totalWordCount() {
    const { selectedIds, subscriptions } = this.data;
    const builtinCount = CATEGORIES
      .filter(c => selectedIds.includes(c.id))
      .reduce((sum, c) => sum + c.words.length, 0);
    const customCount = subscriptions
      .filter(s => selectedIds.includes(s.id))
      .reduce((sum, s) => sum + (s.wordCount || 0), 0);
    return builtinCount + customCount;
  },
});
