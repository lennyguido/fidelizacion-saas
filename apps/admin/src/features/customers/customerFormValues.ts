export interface CustomerFormValues {
  name: string
  phone: string
  email: string
  notes: string
  /** Día y mes del cumpleaños como texto ('' = no se sabe). */
  birthDay: string
  birthMonth: string
}

export const emptyCustomerForm: CustomerFormValues = {
  name: '',
  phone: '',
  email: '',
  notes: '',
  birthDay: '',
  birthMonth: '',
}
