// pages/lobby/index.js
Page({
  data: {
    games: [
      {
        id: 'werewolf',
        name: '狼人真言',
        desc: '村长守护咒语，狼人暗中知晓，村民能否在2分钟内猜出？',
        emoji: '🐺',
        minPlayers: 4,
        maxPlayers: 10,
      }
    ]
  },

  onGameTap(e) {
    const { id } = e.currentTarget.dataset;
    if (id === 'werewolf') {
      wx.navigateTo({ url: '/pages/werewolf/index' });
    }
  }
});
