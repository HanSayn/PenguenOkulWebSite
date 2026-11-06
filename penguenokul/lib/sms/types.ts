// SMS adaptörü sözleşmesi (Netgsm, İleti Merkezi, Twilio vb. aynı arayüzle bağlanır).
export interface SmsProvider {
  readonly name: string;
  send(input: { to: string; text: string }): Promise<void>;
}
