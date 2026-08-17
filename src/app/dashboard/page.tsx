import { redirect } from "next/navigation"

// Rota legada. A página que existia aqui ficava FORA do (private)/layout, então
// renderizava sem sidebar e com métricas fictícias hardcoded (o antigo
// ./viewModel/DashboardViewModel.ts, já removido) — era o que dava a impressão
// de "front deturpado" logo após o login.
//
// O painel real é "/" (item "Piloto Automático" do menu), dentro do
// DashboardLayout. Mantemos este redirect para não quebrar links/favoritos
// antigos que apontem para /dashboard.
export default function LegacyDashboardRedirect() {
  redirect("/")
}
