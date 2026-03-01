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
    // 创建者昵称（选填）
    creatorName: '',
    // 是否允许他人编辑
    allowEdit: false,
    // 当前输入词
    inputWord: '',
    // 已添加的词列表
    words: [],
    // 页面状态: 'edit' | 'done' | 'list'
    pageState: 'edit',
    // 生成的分享码
    shareCode: '',
    // loading
    submitting: false,
    // toast
    toast: '',
    toastType: 'info', // 'info' | 'error'
    // 已订阅词库列表
    subscriptions: [],

    // 自定义导航栏
    statusBarHeight: 0,
    navBarHeight: 44,
    navRightPadding: 100,
  },

  onLoad(options) {
    const { statusBarHeight } = wx.getSystemInfoSync();
    const menuBtn = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
    const navRightPadding = wx.getSystemInfoSync().windowWidth - menuBtn.left + 8;
    this.setData({ statusBarHeight, navBarHeight, navRightPadding });
    this._loadSubscriptions();
    
    // 检查是否从词库设置页跳转过来编辑词库
    if (options.shareCode) {
      this._loadWordbankForEdit(options.shareCode);
    }
  },

  // 加载词库信息用于编辑
  _loadWordbankForEdit(shareCode) {
    const subs = wx.getStorageSync(STORAGE_KEY_SUBSCRIPTIONS) || [];
    const sub = subs.find(s => s.shareCode === shareCode);
    if (sub) {
      this.setData({
        name: sub.name,
        creatorName: sub.creatorName || '',
        allowEdit: sub.allowEdit || false,
        words: sub.words || [],
        shareCode: sub.shareCode,
      });
    }
  },

  onShow() {
    this._loadSubscriptions();
  },

  _loadSubscriptions() {
    const subscriptions = wx.getStorageSync(STORAGE_KEY_SUBSCRIPTIONS) || [];
    this.setData({ subscriptions });
  },

  // ─── 输入处理 ──────────────────────────────────────────

  onNameInput(e) {
    const name = e.detail.value.slice(0, MAX_NAME_LEN);
    this.setData({ name });
  },

  onCreatorNameInput(e) {
    this.setData({ creatorName: e.detail.value.slice(0, 10) });
  },

  toggleAllowEdit() {
    this.setData({ allowEdit: !this.data.allowEdit });
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
    const { name, words, shareCode: existingShareCode } = this.data;

    if (!name.trim()) {
      this._showToast('请输入词库名称', 'error');
      return;
    }
    if (words.length < MIN_WORDS) {
      this._showToast(`至少需要 ${MIN_WORDS} 个词`, 'error');
      return;
    }

    this.setData({ submitting: true });

    const { creatorName, allowEdit } = this.data;
    
    // 查找词库 id（编辑模式）
    let id = null;
    if (existingShareCode) {
      const subs = wx.getStorageSync(STORAGE_KEY_SUBSCRIPTIONS) || [];
      const sub = subs.find(s => s.shareCode === existingShareCode);
      if (sub) {
        id = sub.id;
      }
    }

    wx.cloud.callFunction({
      name: 'wordbankSave',
      config: { env: 'board-game-6g6bcx73f538cbd0' },
      data: {
        id,
        name: name.trim(),
        words,
        creatorName: creatorName.trim(),
        allowEdit,
      },
    }).then(res => {
      const { code, shareCode, error } = res.result || {};
      if (code !== 0) {
        this._showToast(error || '操作失败，请重试', 'error');
        this.setData({ submitting: false });
        return;
      }

      // 自动更新订阅列表
      const subs = wx.getStorageSync(STORAGE_KEY_SUBSCRIPTIONS) || [];
      const dbId = res.result.id;
      
      if (id) {
        // 编辑模式：更新现有词库
        const updatedSubs = subs.map(s => {
          if (s.id === dbId) {
            return {
              ...s,
              name: name.trim(),
              words,
              wordCount: words.length,
              creatorName: creatorName.trim(),
              allowEdit,
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        wx.setStorageSync(STORAGE_KEY_SUBSCRIPTIONS, updatedSubs);
        this._showToast(`词库「${name.trim()}」已更新 ✓`);
      } else {
        // 新建模式：添加新词库
        subs.push({
          id: dbId,
          name: name.trim(),
          shareCode,
          words,
          wordCount: words.length,
          creatorName: creatorName.trim(),
          allowEdit,
          subscribedAt: Date.now(),
        });
        wx.setStorageSync(STORAGE_KEY_SUBSCRIPTIONS, subs);

        const selectedIds = wx.getStorageSync(STORAGE_KEY_CATEGORIES) || [];
        if (!selectedIds.includes(dbId)) {
          wx.setStorageSync(STORAGE_KEY_CATEGORIES, [...selectedIds, dbId]);
        }

        this._showToast(`词库「${name.trim()}」已创建并自动订阅 ✓`);
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

  // ─── 词库列表相关 ──────────────────────────────────────

  // 切换到词库列表页面
  goToWordbankList() {
    this.setData({ pageState: 'list' });
  },

  // 切换到创建词库页面
  goToCreate() {
    this.setData({
      pageState: 'edit',
      name: '',
      creatorName: '',
      allowEdit: false,
      inputWord: '',
      words: [],
      shareCode: '',
    });
  },

  // 编辑词库
  editWordbank(e) {
    const { index } = e.currentTarget.dataset;
    const sub = this.data.subscriptions[index];
    if (!sub) return;
    this.setData({
      pageState: 'edit',
      name: sub.name,
      creatorName: sub.creatorName || '',
      allowEdit: sub.allowEdit || false,
      words: sub.words || [],
      shareCode: sub.shareCode,
    });
  },

  // 删除词库
  deleteWordbank(e) {
    const { index } = e.currentTarget.dataset;
    const sub = this.data.subscriptions[index];
    if (!sub) return;
    
    // 检查是否是词库创建者
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      config: { env: 'board-game-6g6bcx73f538cbd0' },
      data: { type: 'getOpenId' },
    }).then(res => {
      if (res.result && res.result.openid) {
        const openid = res.result.openid;
        if (openid !== sub.creatorOpenId) {
          this._showToast('只有词库创建者才能删除词库', 'error');
          return;
        }
        
        // 显示删除确认弹窗，提醒会影响其他人
        wx.showModal({
          title: '删除词库',
          content: '确定删除该词库吗？删除后无法恢复，且会影响所有订阅该词库的用户。',
          confirmColor: '#e94560',
          success: ({ confirm }) => {
            if (!confirm) return;
            // 调用云函数删除词库
            wx.cloud.callFunction({
              name: 'wordbankDelete',
              config: { env: 'board-game-6g6bcx73f538cbd0' },
              data: { id: sub.id },
            }).then(res => {
              const { code, error } = res.result || {};
              if (code !== 0) {
                this._showToast(error || '删除失败，请重试', 'error');
                return;
              }
              // 从本地存储中删除
              const subs = this.data.subscriptions.filter((_, i) => i !== index);
              wx.setStorageSync(STORAGE_KEY_SUBSCRIPTIONS, subs);
              // 从已选分类中移除
              const selectedIds = wx.getStorageSync(STORAGE_KEY_CATEGORIES) || [];
              const newSelectedIds = selectedIds.filter(id => id !== sub.id);
              wx.setStorageSync(STORAGE_KEY_CATEGORIES, newSelectedIds);
              this.setData({ subscriptions: subs });
              this._showToast('词库已删除');
            }).catch(err => {
              console.error('[wordbankDelete]', err);
              this._showToast('网络错误，请重试', 'error');
            });
          },
        });
      }
    }).catch(err => {
      console.error('[getOpenId] error:', err);
      this._showToast('获取用户信息失败，请重试', 'error');
    });
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
