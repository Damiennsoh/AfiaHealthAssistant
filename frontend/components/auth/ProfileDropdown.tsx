"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  User, 
  LogOut, 
  UserCheck,
  Settings
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/contexts/AfiaAuthContext"

interface ProfileDropdownProps {
  onSwitchUser?: () => void
}

export default function ProfileDropdown({ onSwitchUser }: ProfileDropdownProps) {
  const { user, logout } = useAuth()

  if (!user) return null

  const displayName = user.full_name || user.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-10 hover:bg-emerald-50 rounded-full pr-4 pl-2 border border-transparent hover:border-emerald-100 transition-all">
          <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center shadow-sm">
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="hidden md:inline text-sm font-bold text-slate-700">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 p-2 rounded-2xl shadow-2xl border-slate-100">
        <DropdownMenuLabel className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-xl mb-2">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-emerald-100">
            <UserCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex flex-col space-y-1 leading-none">
            <div className="flex items-center gap-2">
              <p className="font-medium">{displayName}</p>
              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
                {user.role}
              </Badge>
            </div>
            <p className="w-[200px] truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="bg-slate-50" />

        <DropdownMenuItem asChild>
          <Link href="/settings" className="h-11 rounded-lg text-slate-700 font-medium focus:bg-slate-50 cursor-pointer w-full flex items-center">
            <Settings className="mr-3 h-4 w-4 text-slate-400" />
            System Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-50" />

        <DropdownMenuItem onClick={logout} className="h-11 rounded-lg text-red-600 font-bold focus:bg-red-50 focus:text-red-700 cursor-pointer">
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
