export interface CustomerFormValues {
  name: string
  phone: string
  email: string
  notes: string
}

export const emptyCustomerForm: CustomerFormValues = { name: '', phone: '', email: '', notes: '' }
