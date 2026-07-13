import { useAuth } from "@/contexts/auth-context"

export function usePermissions() {
  const { user } = useAuth()

  const canDeletePatient = (): boolean => {
    return user?.role === "super_admin" || user?.role === "clinic_admin" || false
  }

  const canEditPatient = (): boolean => {
    return user ? ["super_admin", "clinic_admin", "healthworker"].includes(user.role) : false
  }

  const getUserDisplayName = (): string => {
    if (!user) return ""

    const roleDisplay = user.role === "super_admin" || user.role === "clinic_admin"
      ? "Admin"
      : "Healthworker"

    return `${roleDisplay} (${user.full_name})`
  }

  const isAdmin = (): boolean => {
    return user?.role === "super_admin" || user?.role === "clinic_admin" || false
  }

  const isHealthworker = (): boolean => {
    return user ? ["super_admin", "clinic_admin", "healthworker"].includes(user.role) : false
  }

  return {
    canDeletePatient,
    canEditPatient,
    getUserDisplayName,
    isAdmin,
    isHealthworker,
  }
}
