class BaseChannel{
    async send(to, subject, body){
        throw new Error("Method 'send' must be implemented.");
    }
}
module.exports = BaseChannel;