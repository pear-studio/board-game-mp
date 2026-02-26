// pages/werewolf/index.js
const { getRandomWords } = require('../../data/wordbank');

// 语音文件映射
const AUDIO = {
  CLOSE_EYES:     '/audio/close_eyes.mp3',     // 所有人请闭眼
  WOLF_WAKE:      '/audio/wolf_wake.mp3',       // 狼人醒过来，查看咒语
  WOLF_SLEEP:     '/audio/wolf_sleep.mp3',      // 狼人请闭眼
  PROPHET_WAKE:   '/audio/prophet_wake.mp3',    // 预言家醒过来，查看咒语
  PROPHET_SLEEP:  '/audio/prophet_sleep.mp3',   // 预言家请闭眼
  OPEN_EYES:      '/audio/open_eyes.mp3',       // 所有人睁眼，游戏开始
};

// 咒语展示倒计时（秒）：给狼人/预言家自动展示词语的时间
const SPELL_SHOW_SECONDS = 8;

// 角色配置表：[狼人数, 预言家数, 村民数]
const ROLE_CONFIG = {
  4:  [1, 1, 2],
  5:  [1, 1, 3],
  6:  [2, 1, 3],
  7:  [2, 1, 4],
  8:  [2, 1, 5],
  9:  [3, 1, 5],
  10: [3, 1, 6],
};

const STEPS = {
  SETUP: 'setup',
  ANNOUNCE_CHIEF: 'announce-chief', // 公布村长
  VIEW_ROLE: 'view-role',           // 轮流查看身份
  CONFIRM_SPELL: 'confirm-spell',   // 确认后交给村长选词
  CHOOSE_SPELL: 'choose-spell',
  VIEW_SPELL: 'view-spell',
  COUNTDOWN: 'countdown',
  VOTE: 'vote',                     // 投票环节
  RESULT: 'result',
};

// 投票讨论时间（秒）
const VOTE_SECONDS = 30;

Page({
  // ─── 语音播放 ───────────────────────────────────────────

  _audioCtx: null,

  /**
   * 播放语音提示，音频文件不存在时静默跳过
   * @param {string} src AUDIO 中定义的路径
   * @param {Function} [onEnd] 播放结束后的回调
   */
  /** 延迟执行，单位毫秒 */
  _delay(ms, callback) {
    const t = setTimeout(() => { callback && callback(); }, ms);
    // 存到实例上，onUnload 时可一并清理
    if (!this._delayTimers) this._delayTimers = [];
    this._delayTimers.push(t);
  },

  _playAudio(src, onEnd) {
    // 停止上一个正在播放的音频
    if (this._audioCtx) {
      try { this._audioCtx.stop(); this._audioCtx.destroy(); } catch (e) {}
      this._audioCtx = null;
    }
    const ctx = wx.createInnerAudioContext();
    ctx.src = src;
    ctx.onEnded(() => {
      ctx.destroy();
      this._audioCtx = null;
      if (onEnd) onEnd();
    });
    ctx.onError(() => {
      // 音频文件不存在时静默跳过，不影响游戏流程
      ctx.destroy();
      this._audioCtx = null;
      if (onEnd) onEnd();
    });
    ctx.play();
    this._audioCtx = ctx;
  },

  data: {
    currentStep: STEPS.SETUP,

    // 设置阶段
    playerCount: 6,
    wolfCount: 2,       // 可手动调整
    prophetCount: 1,    // 可手动调整
    villagerCount: 3,   // 自动 = playerCount - wolf - prophet
    totalTime: 120,     // 猜词时间（秒），可手动调整
    totalTimeLabel: '2分',  // 格式化后的时间文字

    // 游戏状态
    players: [],        // [{id, name, role, isChief}]
    chiefId: -1,        // 村长的玩家id
    spell: '',          // 本局咒语
    wordChoices: [],    // 村长可选的3个词

    // 查看身份阶段
    roleViewIndex: 0,   // 当前轮到第几号玩家查看身份（0-based）
    roleVisible: false, // 身份是否可见

    // 查看咒语阶段
    viewQueue: [],      // 待查看的列表 [{label, role, isGroup, members}]
    viewIndex: 0,       // 当前轮到第几个
    spellVisible: false,// 咒语是否可见（按住时为true）
    spellCountdown: 0,  // 四方向展示倒计时（秒）

    // 倒计时阶段
    remainTime: 120,
    startTimestamp: 0,

    // 结果阶段
    villagerWin: false,
    finalWinner: '',    // 'villager' | 'wolf'

    // 投票阶段
    // voteType: 'find-prophet'（村民赢后狼人投预言家）| 'find-wolf'（狼人赢后村民投狼人）
    voteType: '',
    voteCountdown: 0,
    voteCountdownAlert: false, // 最后3秒放大+变红

    // 语音提示文字（显示在界面上）
    audioHint: '',

    // 规则弹窗
    showRules: false,

    // 自定义导航栏
    statusBarHeight: 0,
    navBarHeight: 44,       // 导航栏内容区高度（px）
    navRightPadding: 100,   // 右侧为胶囊留出的空间（px）
  },

  _timer: null,
  _voteTimer: null,

  onLoad() {
    // 获取状态栏高度 + 胶囊按钮位置，用于自定义导航栏
    const { statusBarHeight } = wx.getSystemInfoSync();
    const menuBtn = wx.getMenuButtonBoundingClientRect();
    // 导航栏高度 = 胶囊底部 + (胶囊顶部 - 状态栏底部) 的对称留白
    const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
    // 右侧内容区域终止于胶囊左侧，留 8px 间距
    const navRightPadding = wx.getSystemInfoSync().windowWidth - menuBtn.left + 8;
    this.setData({ statusBarHeight, navBarHeight, navRightPadding });
  },

  // ─── 规则弹窗 & 重置 ────────────────────────────────────
  openRules() {
    this.setData({ showRules: true });
  },
  closeRules() {
    this.setData({ showRules: false });
  },
  goSetup() {
    this._stopTimer();
    this._stopVoteTimer();
    this._stopSpellCountdown();
    if (this._audioCtx) {
      try { this._audioCtx.stop(); this._audioCtx.destroy(); } catch (e) {}
      this._audioCtx = null;
    }
    if (this._delayTimers) {
      this._delayTimers.forEach(t => clearTimeout(t));
      this._delayTimers = [];
    }
    this.setData({
      currentStep: STEPS.SETUP,
      players: [], chiefId: -1, spell: '', wordChoices: [],
      viewQueue: [], viewIndex: 0, spellVisible: false, spellCountdown: 0,
      remainTime: 120, startTimestamp: 0,
      villagerWin: false, finalWinner: '',
      voteType: '', voteCountdown: 0, voteCountdownAlert: false,
      audioHint: '',
    });
  },

  // ─── 设置阶段 ───────────────────────────────────────────

  onPlayerCountChange(e) {
    const playerCount = parseInt(e.detail.value) + 4;
    const [wolfCount, prophetCount] = ROLE_CONFIG[playerCount];
    const villagerCount = playerCount - wolfCount - prophetCount;
    this.setData({ playerCount, wolfCount, prophetCount, villagerCount });
  },

  // 调整角色数量（+1/-1），保证合法范围
  changeRoleCount(e) {
    const { role } = e.currentTarget.dataset;
    const delta = parseInt(e.currentTarget.dataset.delta);
    let { wolfCount, prophetCount, playerCount } = this.data;

    if (role === 'wolf') {
      // 狼人最少 0 个，最多不能把村民挤没（至少留 1 个村民）
      wolfCount = Math.max(0, Math.min(wolfCount + delta, playerCount - prophetCount - 1));
    } else if (role === 'prophet') {
      prophetCount = Math.max(0, Math.min(prophetCount + delta, playerCount - wolfCount - 1));
    }
    const villagerCount = playerCount - wolfCount - prophetCount;
    this.setData({ wolfCount, prophetCount, villagerCount });
  },

  // 调整猜词时间
  changeTotalTime(e) {
    const { delta } = e.currentTarget.dataset;
    const totalTime = Math.max(30, Math.min(300, this.data.totalTime + parseInt(delta)));
    this.setData({ totalTime, totalTimeLabel: this._formatTime(totalTime) });
  },

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0 && s > 0) return `${m}分${s}秒`;
    if (m > 0) return `${m}分`;
    return `${s}秒`;
  },

  startGame() {
    const { playerCount, wolfCount, prophetCount, villagerCount } = this.data;

    // 生成角色池
    const roles = [
      ...Array(wolfCount).fill('狼人'),
      ...Array(prophetCount).fill('预言家'),
      ...Array(villagerCount).fill('村民'),
    ];

    // Fisher-Yates 洗牌
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    // 随机选村长
    const chiefId = Math.floor(Math.random() * playerCount);

    // 生成玩家列表（按座位号1~N顺序）
    const players = Array.from({ length: playerCount }, (_, i) => ({
      id: i,
      name: `${i + 1}号玩家`,
      role: roles[i],
      isChief: i === chiefId,
    }));

    // 随机3个词供村长选
    const wordChoices = getRandomWords(3);

    // 先公布村长
    this.setData({
      players,
      chiefId,
      wordChoices,
      spell: '',
      roleViewIndex: 0,
      roleVisible: false,
      currentStep: STEPS.ANNOUNCE_CHIEF,
    });
  },

  // ─── 公布村长阶段 ────────────────────────────────────────

  // 确认知晓村长后，判断是否需要查看身份
  confirmChief() {
    const { wolfCount, prophetCount } = this.data;
    if (wolfCount === 0 && prophetCount === 0) {
      // 全村民：跳过身份环节，直接让村长选词
      // 注意：不经过身份环节，普通玩家不会看到选词页面
      this.setData({ currentStep: STEPS.CHOOSE_SPELL });
    } else {
      this.setData({ currentStep: STEPS.VIEW_ROLE });
    }
  },

  // ─── 查看身份阶段 ────────────────────────────────────────

  showRole() {
    this.setData({ roleVisible: true });
  },

  hideRole() {
    this.setData({ roleVisible: false });
  },

  confirmRoleViewed() {
    const { roleViewIndex, players } = this.data;
    const next = roleViewIndex + 1;
    if (next >= players.length) {
      // 所有人都看完身份，进入"确认交给村长"界面
      this.setData({ currentStep: STEPS.CONFIRM_SPELL, roleVisible: false });
    } else {
      this.setData({ roleViewIndex: next, roleVisible: false });
    }
  },

  // ─── 确认交给村长阶段 ─────────────────────────────────────

  // 点击"确认"后跳转到村长选词
  goChooseSpell() {
    this.setData({ currentStep: STEPS.CHOOSE_SPELL });
  },

  // ─── 选词阶段 ───────────────────────────────────────────

  chooseSpell(e) {
    const spell = e.currentTarget.dataset.word;
    const { players } = this.data;

    // 构建查看队列：所有狼人合并为一个"团体"条目，预言家单独一个条目
    const wolves = players.filter(p => p.role === '狼人').sort((a, b) => a.id - b.id);
    const prophets = players.filter(p => p.role === '预言家').sort((a, b) => a.id - b.id);

    const viewQueue = [];
    if (wolves.length > 0) {
      viewQueue.push({
        role: '狼人',
        isGroup: true,
        label: wolves.map(p => `${p.id + 1}号`).join('、'),
        members: wolves,
      });
    }
    prophets.forEach(p => {
      viewQueue.push({
        role: '预言家',
        isGroup: false,
        label: `${p.id + 1}号玩家`,
        members: [p],
      });
    });

    if (viewQueue.length === 0) {
      // 没有狼人和预言家：播"所有人睁眼"语音，同时立即开始倒计时
      this.setData({ spell, viewQueue });
      this._showAudioHint('👁 所有人睁眼，游戏开始！');
      this._playAudio(AUDIO.OPEN_EYES, () => {
        this._clearAudioHint();
      });
      this.startCountdown();
      return;
    }

    this.setData({
      spell,
      viewQueue,
      viewIndex: 0,
      spellVisible: false,
      currentStep: STEPS.VIEW_SPELL,
    });

    // 🔊 语音：所有人请闭眼 → 3秒后播第一个角色的提示
    this._showAudioHint('🔇 所有人请闭眼');
    this._playAudio(AUDIO.CLOSE_EYES, () => {
      this._playRoleWakeAudio(viewQueue[0]);
    });
  },

  /** 根据当前条目播放对应的醒来语音 */
  _playRoleWakeAudio(entry) {
    if (!entry) return;
    const isWolf = entry.role === '狼人';
    const hint = isWolf ? '🐺 狼人醒过来，查看咒语' : '🔮 预言家醒过来，查看咒语';
    // 闭眼音频结束后先等3秒，再播角色唤醒语音
    this._delay(3000, () => {
      this._showAudioHint(hint);
      this._playAudio(isWolf ? AUDIO.WOLF_WAKE : AUDIO.PROPHET_WAKE, () => {
        this._clearAudioHint();
        // 语音播完后自动开始四方向展示倒计时
        this._startSpellCountdown();
      });
    });
  },

  /** 显示语音字幕提示 */
  _showAudioHint(text) {
    this.setData({ audioHint: text });
  },

  /** 清除语音字幕提示 */
  _clearAudioHint() {
    this.setData({ audioHint: '' });
  },

  // ─── 查看咒语阶段（四方向自动展示） ─────────────────────

  /** 当切换到 VIEW_SPELL 后，自动开始该条目的展示倒计时 */
  _startSpellCountdown() {
    this._stopSpellCountdown();
    this.setData({ spellCountdown: SPELL_SHOW_SECONDS, spellVisible: true });
    this._spellTimer = setInterval(() => {
      const cd = this.data.spellCountdown - 1;
      if (cd <= 0) {
        this._stopSpellCountdown();
        this.setData({ spellCountdown: 0, spellVisible: false });
        // 自动执行"已查看"
        this._onSpellCountdownEnd();
      } else {
        this.setData({ spellCountdown: cd });
      }
    }, 1000);
  },

  _stopSpellCountdown() {
    if (this._spellTimer) {
      clearInterval(this._spellTimer);
      this._spellTimer = null;
    }
  },

  /** 倒计时结束后自动进入下一步 */
  _onSpellCountdownEnd() {
    const { viewIndex, viewQueue } = this.data;
    const currentEntry = viewQueue[viewIndex];
    const next = viewIndex + 1;

    if (next >= viewQueue.length) {
      // 最后一个角色看完：播"请闭眼"→ 再播"所有人睁眼"→ 开始倒计时
      const isWolf = currentEntry.role === '狼人';
      const sleepSrc = isWolf ? AUDIO.WOLF_SLEEP : AUDIO.PROPHET_SLEEP;
      const sleepHint = isWolf ? '🐺 狼人请闭眼' : '🔮 预言家请闭眼';
      this._showAudioHint(sleepHint);
      this._playAudio(sleepSrc, () => {
        this._delay(2000, () => {
          this._showAudioHint('👁 所有人睁眼，游戏开始！');
          this._playAudio(AUDIO.OPEN_EYES, () => {
            this._clearAudioHint();
          });
          this.startCountdown();
        });
      });
    } else {
      // 还有下一个角色：播"请闭眼" → 再唤醒下一个
      const isWolf = currentEntry.role === '狼人';
      const sleepSrc = isWolf ? AUDIO.WOLF_SLEEP : AUDIO.PROPHET_SLEEP;
      const sleepHint = isWolf ? '🐺 狼人请闭眼' : '🔮 预言家请闭眼';
      this._showAudioHint(sleepHint);
      this._playAudio(sleepSrc, () => {
        this._clearAudioHint();
        this.setData({ viewIndex: next });
        this._playRoleWakeAudio(viewQueue[next]);
      });
    }
  },

  /** 手动点击"已看完"提前结束 */
  confirmViewed() {
    this._stopSpellCountdown();
    this.setData({ spellVisible: false });
    this._onSpellCountdownEnd();
  },

  // ─── 倒计时阶段 ─────────────────────────────────────────

  startCountdown() {
    const { totalTime } = this.data;
    const startTimestamp = Date.now();
    this.setData({
      currentStep: STEPS.COUNTDOWN,
      remainTime: totalTime,
      startTimestamp,
      spellVisible: false,
    });
    this._startTimer();
  },

  _startTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      const { totalTime, startTimestamp } = this.data;
      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
      const remainTime = Math.max(0, totalTime - elapsed);
      this.setData({ remainTime });
      if (remainTime <= 0) {
        this._stopTimer();
        this._onCountdownEnd();
      }
    }, 500);
  },

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  // 小程序切换后台时修正计时
  onHide() {
    this._stopTimer();
  },

  onShow() {
    if (this.data.currentStep === STEPS.COUNTDOWN && this.data.startTimestamp) {
      const { totalTime, startTimestamp } = this.data;
      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
      const remainTime = Math.max(0, totalTime - elapsed);
      if (remainTime <= 0) {
        this.setData({ remainTime: 0 });
        this._onCountdownEnd();
      } else {
        this.setData({ remainTime });
        this._startTimer();
      }
    }
  },

  onUnload() {
    this._stopTimer();
    this._stopVoteTimer();
    this._stopSpellCountdown();
    // 清理所有延迟定时器
    if (this._delayTimers) {
      this._delayTimers.forEach(t => clearTimeout(t));
      this._delayTimers = [];
    }
    if (this._audioCtx) {
      try { this._audioCtx.stop(); this._audioCtx.destroy(); } catch (e) {}
      this._audioCtx = null;
    }
  },

  // 村民猜出咒语 → 进入投票或直接结束
  villagerGuessed() {
    this._stopTimer();
    const { prophetCount } = this.data;
    if (prophetCount > 0) {
      // 有预言家：进入"狼人投预言家"投票环节
      this._startVote('find-prophet');
    } else {
      // 没有预言家：村民直接获胜
      this.setData({ currentStep: STEPS.RESULT, villagerWin: true, finalWinner: 'villager' });
    }
  },

  // 时间到，狼人获胜 → 进入投票或直接结束
  _onCountdownEnd() {
    const { wolfCount } = this.data;
    if (wolfCount > 0) {
      // 有狼人：进入"所有人投狼人"投票环节
      this._startVote('find-wolf');
    } else {
      // 没有狼人：狼人方直接获胜（其实是村民全都没猜出，理论上不会出现，但兜底）
      this.setData({ currentStep: STEPS.RESULT, villagerWin: false, finalWinner: 'wolf' });
    }
  },

  // ─── 投票阶段 ───────────────────────────────────────────

  _startVote(voteType) {
    this.setData({
      currentStep: STEPS.VOTE,
      voteType,
      voteCountdown: VOTE_SECONDS,
      voteCountdownAlert: false,
    });
    this._voteTimer = setInterval(() => {
      const cd = this.data.voteCountdown - 1;
      if (cd <= 0) {
        this._stopVoteTimer();
        this.setData({ voteCountdown: 0, voteCountdownAlert: false });
        // 投票时间到，自动进入投票结果输入
      } else {
        this.setData({
          voteCountdown: cd,
          voteCountdownAlert: cd <= 3,
        });
      }
    }, 1000);
  },

  _stopVoteTimer() {
    if (this._voteTimer) {
      clearInterval(this._voteTimer);
      this._voteTimer = null;
    }
  },

  // 投票结果：找到了目标（预言家/狼人）
  voteHit() {
    this._stopVoteTimer();
    const { voteType } = this.data;
    if (voteType === 'find-prophet') {
      // 狼人找到预言家 → 狼人胜
      this.setData({ currentStep: STEPS.RESULT, villagerWin: false, finalWinner: 'wolf' });
    } else {
      // 村民找到狼人 → 村民胜
      this.setData({ currentStep: STEPS.RESULT, villagerWin: true, finalWinner: 'villager' });
    }
  },

  // 投票结果：没找到（或平票）
  voteMiss() {
    this._stopVoteTimer();
    const { voteType } = this.data;
    if (voteType === 'find-prophet') {
      // 狼人没找到预言家 → 村民胜（预言家保护成功）
      this.setData({ currentStep: STEPS.RESULT, villagerWin: true, finalWinner: 'villager' });
    } else {
      // 村民没找到狼人（平票含狼人也算村民胜）→ 狼人胜
      this.setData({ currentStep: STEPS.RESULT, villagerWin: false, finalWinner: 'wolf' });
    }
  },

  // 平票且其中一人是狼人 → 村民胜（find-wolf 专用）
  voteTieWithWolf() {
    this._stopVoteTimer();
    this.setData({ currentStep: STEPS.RESULT, villagerWin: true, finalWinner: 'villager' });
  },

  // ─── 结果阶段 ───────────────────────────────────────────

  restartGame() {
    this._stopTimer();
    this._stopVoteTimer();
    this._stopSpellCountdown();
    this.setData({
      currentStep: STEPS.SETUP,
      players: [],
      chiefId: -1,
      spell: '',
      wordChoices: [],
      viewQueue: [],
      viewIndex: 0,
      spellVisible: false,
      spellCountdown: 0,
      remainTime: 120,
      startTimestamp: 0,
      villagerWin: false,
      finalWinner: '',
      voteType: '',
      voteCountdown: 0,
      voteCountdownAlert: false,
    });
  },
});
