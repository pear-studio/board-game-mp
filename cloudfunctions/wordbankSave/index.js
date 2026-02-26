// cloudfunctions/wordbankSave/index.js
// 云函数：创建自定义词库，含敏感词检测 + 生成唯一6位分享码

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLL = 'wordbanks';

// 分享码字符集（去掉容易混淆的 0/O/I/1/L）
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 6;
const MAX_RETRY = 5;

function genCode() {
  let code = '';
  for (let i = 0; i < CODE_LEN; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { name, words } = event;

  // ── 基础校验 ───────────────────────────────
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { code: 1, error: '词库名称不能为空' };
  }
  if (!Array.isArray(words) || words.length < 5) {
    return { code: 2, error: '至少需要 5 个词' };
  }
  if (words.length > 100) {
    return { code: 3, error: '词条数量不能超过 100' };
  }

  // ── 去重 & 字符校验 ──────────────────────────
  const cleaned = [...new Set(
    words.map(w => String(w).trim()).filter(w => w.length > 0 && w.length <= 10)
  )];
  if (cleaned.length < 5) {
    return { code: 4, error: '有效词条不足 5 个' };
  }

  // ── 敏感词检测（词库名 + 所有词条合并检测）───
  const contentToCheck = [name.trim(), ...cleaned].join(' ');
  try {
    await cloud.openapi.security.msgSecCheck({
      content: contentToCheck,
      version: 2,
      scene: 2, // 资料场景
      openid: OPENID,
    });
  } catch (err) {
    // errCode 87014 = 内容含违规信息
    if (err && err.errCode === 87014) {
      return { code: 5, error: '词库内容含有违规词汇，请修改后重试' };
    }
    // 其余网络/超时错误：放行（不因检测失败阻断创建）
    console.warn('[msgSecCheck] warn:', err);
  }

  // ── 生成唯一分享码（碰撞重试）───────────────
  let shareCode = '';
  for (let i = 0; i < MAX_RETRY; i++) {
    const candidate = genCode();
    const snap = await db.collection(COLL)
      .where({ shareCode: candidate })
      .count();
    if (snap.total === 0) {
      shareCode = candidate;
      break;
    }
  }
  if (!shareCode) {
    return { code: 6, error: '系统繁忙，请稍后重试' };
  }

  // ── 写入数据库 ────────────────────────────────
  const now = Date.now();
  const addRes = await db.collection(COLL).add({
    data: {
      name: name.trim(),
      words: cleaned,
      shareCode,
      creatorOpenId: OPENID,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    code: 0,
    id: addRes._id,
    shareCode,
  };
};
