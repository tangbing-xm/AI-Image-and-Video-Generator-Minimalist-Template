import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { Provider } from "next-auth/providers/index";
import { createCreditUsage } from "@/backend/service/credit_usage";
import { getCreditUsageByUserId } from "@/backend/service/credit_usage";
import { saveUser } from "@/backend/service/user";
import { User } from "@/backend/type/type";
import { genUniSeq, getIsoTimestr } from "@/backend/utils";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  throw new Error("Google OAuth environment variables are not configured correctly.");
}

const providers: Provider[] = [
  GoogleProvider({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
  }),
];

const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();

const authOptions: AuthOptions = {
  ...(nextAuthSecret ? { secret: nextAuthSecret } : {}),
  providers,
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      const isAllowedToSignIn = true;
      if (isAllowedToSignIn) {
        return true;
      } else {
        return false;
      }
    },
    async redirect({ url, baseUrl }) {
      return `${baseUrl}/`;
    },
    async session({ session, token, user }) {
      if (token && token.user) {
        session.user = token.user;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user && user.email && account) {
        const dbUser: User = {
          uuid: genUniSeq(),
          email: user.email,
          nickname: user.name || "",
          avatar_url: user.image || "",
          signin_type: account.type,
          signin_provider: account.provider,
          signin_openid: account.providerAccountId,
          created_at: getIsoTimestr(),
          signin_ip: "",
        };
        await saveUser(dbUser);
        const creditUsage = await getCreditUsageByUserId(dbUser.uuid);
        if (!creditUsage) {
          await createCreditUsage({
            user_id: dbUser.uuid,
            user_subscriptions_id: -1,
            is_subscription_active: false,
            used_count: 0,
            // 赠送的积分数
            period_remain_count: 20,
            period_start: new Date(),
            period_end: new Date(
              new Date().setMonth(new Date().getMonth() + 1)
            ),
            created_at: new Date(),
          });
        }
        token.user = {
          uuid: dbUser.uuid,
          nickname: dbUser.nickname,
          email: dbUser.email,
          avatar_url: dbUser.avatar_url,
          created_at: dbUser.created_at,
        };
      }
      return token;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
