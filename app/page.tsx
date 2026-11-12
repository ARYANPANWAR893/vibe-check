import VibeApp from "./VibeApp";

export default function Page() {
  return <VibeApp paypalClientId={process.env.PAYPAL_CLIENT_ID ?? ""} />;
}

export const dynamic = "force-dynamic"; // read PAYPAL_CLIENT_ID at request time
