// cloudfunctions/wordbankDelete/index.js
// 云函数：删除自定义词库

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLL = 'wordbanks';

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { id } = event;

  if (!id) {
    return { code: 1, error: '词库 ID 不能为空' };
  }

  // 检查词库是否存在且当前用户是创建者
  const doc = await db.collection(COLL).doc(id).get();
  if (!doc.data) {
    return { code: 2, error: '词库不存在' };
  }
  if (doc.data.creatorOpenId !== OPENID) {
    return { code: 3, error: '无权限删除该词库' };
  }

  // 删除词库
  await db.collection(COLL).doc(id).remove();

  return { code: 0, message: '删除成功' };
};
