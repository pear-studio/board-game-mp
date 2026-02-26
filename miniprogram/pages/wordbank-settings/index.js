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
    // 订阅的自定义词库列表 [{id, name, shareCode, words, wordCount, subscribedAt}]
    subscriptions: [],
    // 输入框：分享码
    inputShareCode: '',
    // 状态
    loading: false,
    toast: '',

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

  _loadData() {
    // 加载已选分类
    let selectedIds = wx.getStorageSync(STORAGE_KEY_CATEGORIES);
    if (!selectedIds || !selectedIds.length) {
      selectedIds = [...DEFAULT_SELECTED];
      wx.setStorageSync(STORAGE_KEY_CATEGORIES, selectedIds);
    }

    // 加载订阅词库
    const subscriptions = wx.getStorageSync(STORAGE_KEY_SUBSCRIPTIONS) || [];

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
    let { selectedIds } = this.data;
    const idx = selectedIds.indexOf(id);
    if (idx >= 0) {
      selectedIds = selectedIds.filter(x => x !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
    wx.setStorageSync(STORAGE_KEY_CATEGORIES, selectedIds);
    this.setData({ selectedIds });
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
