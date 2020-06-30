import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export default class Mailer {
  static async sendConfirmation(email: string, token: string): Promise<boolean> {
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL!,
      templateId: process.env.SENDGRID_CONFIRM_TEMPLATE_ID!,
      dynamic_template_data: { confirm_token: token }
    };
    return await this.send(msg);
  }

  static async sendForgotPassword(email: string, token: string): Promise<boolean> {
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL!,
      templateId: process.env.SENDGRID_FORGOT_PASSWORD_TEMPLATE_ID!,
      dynamic_template_data: { password_token: token }
    };
    return await this.send(msg);
  }

  static async send(msg: any): Promise<boolean> {
    try {
      await sgMail.send(msg);
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }
}