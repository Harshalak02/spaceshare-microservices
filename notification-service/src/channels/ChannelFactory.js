const ConsoleChannel = require('./ConsoleChannel');
const EmailChannel = require('./EmailChannel');

class ChannelFactory {
  static getChannel() {
    const channelName = process.env.NOTIFICATION_CHANNEL || 'console';
    
    switch (channelName.toLowerCase()) {
      case 'email':
        return new EmailChannel();
      case 'console':
      default:
        return new ConsoleChannel();
    }
  }
}

module.exports = ChannelFactory;
