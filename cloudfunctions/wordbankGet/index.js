// cloudfunctions/wordbankGet/index.js
// 云函数：通过分享码查询词库内容

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLL = 'wordbanks';

exports.main = async (event) => {
  const { shareCode } = event;

  if (!shareCode || typeof shareCode !== 'string') {
    return { code: 1, error: '分享码无效' };
  }

  const code = shareCode.trim().toUpperCase();
  if (code.length !== 6) {
    return { code: 2, error: '分享码格式错误' };
  }

  const snap = await db.collection(COLL)
    .where({ shareCode: code })
    .limit(1)
    .get();

  if (!snap.data || snap.data.length === 0) {
    return { code: 3, wordbank: null };
  }

  const doc = snap.data[0];
  return {
    code: 0,
    wordbank: {
      _id: doc._id,
      name: doc.name,
      words: doc.words,
      shareCode: doc.shareCode,
      wordCount: (doc.words || []).length,
      createdAt: doc.createdAt,
    },
  };
};
