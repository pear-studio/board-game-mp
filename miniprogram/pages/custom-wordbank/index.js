// pages/custom-wordbank/index.js
const STORAGE_KEY_SUBSCRIPTIONS = 'wordbank_subscriptions';
const STORAGE_KEY_CATEGORIES = 'wordbank_selected_categories';

const MAX_WORDS = 100;
const MIN_WORDS = 5;
const MAX_NAME_LEN = 20;
const MAX_WORD_LEN = 10;

Page({
  data: {
    // 词库名称
    name: '',
    // 当前输入词
    inputWord: '',
    // 已添加的词列表
    words: [],
    // 页面状态: 'edit' | 'done'
    pageState: 'edit',
    // 生成的分享码
    shareCode: '',
    // loading
    submitting: false,
    // toast
    toast: '',
    toastType: 'info', // 'info' | 'error'

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
  },

  // ─── 输入处理 ──────────────────────────────────────────

  onNameInput(e) {
    const name = e.detail.value.slice(0, MAX_NAME_LEN);
    this.setData({ name });
  },

  onWordInput(e) {
    // 去空格、限制长度
    const inputWord = e.detail.value.replace(/\s/g, '').slice(0, MAX_WORD_LEN);
    this.setData({ inputWord });
  },

  addWord() {
    const word = this.data.inputWord.trim();
    if (!word) return;
    if (this.data.words.length >= MAX_WORDS) {
      this._showToast(`最多添加 ${MAX_WORDS} 个词`, 'error');
      return;
    }
    if (this.data.words.includes(word)) {
      this._showToast('该词已存在', 'error');
      return;
    }
    this.setData({
      words: [...this.data.words, word],
      inputWord: '',
    });
  },

  // 点击词条删除
  removeWord(e) {
    const { index } = e.currentTarget.dataset;
    const words = [...this.data.words];
    words.splice(index, 1);
    this.setData({ words });
  },

  // ─── 提交创建 ──────────────────────────────────────────

  submitWordbank() {
    const { name, words } = this.data;

    if (!name.trim()) {
      this._showToast('请输入词库名称', 'error');
      return;
    }
    if (words.length < MIN_WORDS) {
      this._showToast(`至少需要 ${MIN_WORDS} 个词`, 'error');
      return;
    }

    this.setData({ submitting: true });

    wx.cloud.callFunction({
      name: 'wordbankSave',
      data: { name: name.trim(), words },
    }).then(res => {
      const { code, shareCode, error } = res.result || {};
      if (code !== 0) {
        this._showToast(error || '创建失败，请重试', 'error');
        this.setData({ submitting: false });
        return;
      }

      // 自动写入订阅列表 + 勾选
      const subs = wx.getStorageSync(STORAGE_KEY_SUBSCRIPTIONS) || [];
      const dbId = res.result.id;
      subs.push({
        id: dbId,
        name: name.trim(),
        shareCode,
        words,
        wordCount: words.length,
        subscribedAt: Date.now(),
      });
      wx.setStorageSync(STORAGE_KEY_SUBSCRIPTIONS, subs);

      const selectedIds = wx.getStorageSync(STORAGE_KEY_CATEGORIES) || [];
      if (!selectedIds.includes(dbId)) {
        wx.setStorageSync(STORAGE_KEY_CATEGORIES, [...selectedIds, dbId]);
      }

      this.setData({
        shareCode,
        pageState: 'done',
        submitting: false,
      });
    }).catch(err => {
      console.error('[wordbankSave]', err);
      this._showToast('网络错误，请重试', 'error');
      this.setData({ submitting: false });
    });
  },

  // ─── 完成页操作 ────────────────────────────────────────

  copyShareCode() {
    wx.setClipboardData({
      data: this.data.shareCode,
      success: () => this._showToast('分享码已复制 ✓'),
    });
  },

  shareToFriend() {
    // 触发转发（在 onShareAppMessage 中附带词库名）
    wx.showShareMenu({ withShareTicket: false });
  },

  goBack() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    return {
      title: `我创建了词库「${this.data.name}」，分享码：${this.data.shareCode}，快来订阅！`,
      path: '/pages/wordbank-settings/index',
    };
  },

  // ─── 工具 ──────────────────────────────────────────────

  _showToast(text, type = 'info') {
    this.setData({ toast: text, toastType: type });
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.setData({ toast: '' });
    }, 2500);
  },
});
