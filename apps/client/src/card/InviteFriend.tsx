import { card as cardApi, type CardReferral } from '@plataforma/sdk'

/** "Traé un amigo": el código del socio y un botón para mandarlo por WhatsApp (D-036). */
export function InviteFriend({
  referral,
  businessName,
  unit,
}: {
  referral: CardReferral
  businessName: string
  unit: string
}) {
  const text = cardApi.referralShareText(businessName, referral)
  return (
    <section
      className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-sm"
      data-testid="invite"
    >
      <h2 className="font-semibold">Traé un amigo</h2>
      <p className="text-sm text-slate-600">
        Cuando venga por primera vez y diga tu código en la caja
        {referral.referrerPoints > 0 && `, sumás ${referral.referrerPoints} ${unit}`}.
      </p>
      <p className="text-center font-mono text-2xl font-bold tracking-widest">{referral.code}</p>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        className="self-center rounded-full bg-action px-5 py-2.5 text-sm font-medium text-white"
      >
        Invitar por WhatsApp
      </a>
    </section>
  )
}
