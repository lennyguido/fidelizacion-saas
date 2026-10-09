import { createBrowserRouter } from 'react-router'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { PublicOnly, RequireAuth } from '../features/auth/guards'
import { LoginPage } from '../features/auth/LoginPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { SignupPage } from '../features/auth/SignupPage'
import { BusinessLayout } from '../features/business/BusinessLayout'
import { BusinessSettingsPage } from '../features/business/BusinessSettingsPage'
import { HomeRedirect } from '../features/business/HomeRedirect'
import { OnboardingPage } from '../features/business/OnboardingPage'
import { CounterPage } from '../features/counter/CounterPage'
import { CustomerDetailPage } from '../features/customers/CustomerDetailPage'
import { CustomersPage } from '../features/customers/CustomersPage'
import { ImportCustomersPage } from '../features/customers/ImportCustomersPage'
import { NewCustomerPage } from '../features/customers/NewCustomerPage'
import { AcceptInvitationPage } from '../features/team/AcceptInvitationPage'
import { TeamPage } from '../features/team/TeamPage'
import { moduleManifests } from '../modules/registry'
import { RequireModule } from '../modules/RequireModule'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'

const moduleRoutes = moduleManifests.flatMap((manifest) =>
  manifest.routes.map((route) => ({
    ...route,
    element: <RequireModule id={manifest.id}>{route.element}</RequireModule>,
  })),
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: '/signup',
    element: (
      <PublicOnly>
        <SignupPage />
      </PublicOnly>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <PublicOnly>
        <ForgotPasswordPage />
      </PublicOnly>
    ),
  },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/invitacion/:token',
    element: (
      <RequireAuth>
        <AcceptInvitationPage />
      </RequireAuth>
    ),
  },
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <OnboardingPage />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <HomeRedirect />
      </RequireAuth>
    ),
  },
  {
    path: '/b/:slug',
    element: (
      <RequireAuth>
        <BusinessLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'mostrador', element: <CounterPage /> },
      { path: 'clientes', element: <CustomersPage /> },
      { path: 'clientes/nuevo', element: <NewCustomerPage /> },
      { path: 'clientes/importar', element: <ImportCustomersPage /> },
      { path: 'clientes/:customerId', element: <CustomerDetailPage /> },
      { path: 'equipo', element: <TeamPage /> },
      { path: 'negocio', element: <BusinessSettingsPage /> },
      ...moduleRoutes,
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
