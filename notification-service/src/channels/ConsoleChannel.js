const BaseChannel = require('./BaseChannel');
class ConsoleChannel extends BaseChannel {
  constructor(){
    super();  
  }
  async send(to, subject, body) {
    console.log(`\n================= CONSOLE NOTIFICATION =================`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`--------------------------------------------------------`);
    console.log(`${body}`);
    console.log(`========================================================\n`);
    return { status: 'sent', providerResponse: 'logged to console' };
  }
}

module.exports = ConsoleChannel;
