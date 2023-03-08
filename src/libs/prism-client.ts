export default class PrismClient {
  prismUrl: any;
  requestClient: any;
  constructor(prismUrl, requestClient) {
    this.prismUrl = prismUrl;
    this.requestClient = requestClient;
  }

  request(opts): any {
    opts.uri = opts.uri.replace(/^https:\/\/.*?\.twilio\.com/, this.prismUrl);
    return this.requestClient.request(opts);
  }
}
