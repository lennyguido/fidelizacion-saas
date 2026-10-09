// Componentes reutilizables de la plataforma. Solo presentación:
// sin acceso a datos ni lógica de negocio.
export { cn } from './cn.ts'
export { Alert } from './Alert.tsx'
export { Button, type ButtonProps } from './Button.tsx'
export { Card } from './Card.tsx'
export { EmptyState } from './EmptyState.tsx'
export { ErrorBoundary } from './ErrorBoundary.tsx'
export { TextField, type TextFieldProps } from './Field.tsx'
export { FullPageSpinner, Spinner } from './Spinner.tsx'
export { ToastProvider } from './toast.tsx'
export { useToast, type ToastApi, type ToastTone } from './toast-context.ts'
