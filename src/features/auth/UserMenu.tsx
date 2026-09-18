import { Building2, LoaderCircle, LogOut, Mail, UserRound, Users } from 'lucide-react';

import { Avatar } from '../../components/ui/Avatar';
import { Menu, MenuGroupLabel, MenuItem, MenuLink, MenuSeparator } from '../../components/ui/Menu';
import { useSession } from './auth-api';
import { useSignOut } from './use-sign-out';

export function UserMenu() {
  const session = useSession({ enabled: false }).data;
  const { signOut, pending } = useSignOut();

  if (!session) return null;
  const { user } = session;

  return (
    <Menu
      label={`Menu da conta de ${user.name}`}
      trigger={<Avatar id={user.id} name={user.name} avatarUpdatedAt={user.avatarUpdatedAt} />}
      triggerClassName="inline-flex size-10 items-center justify-center rounded-full hover:bg-hover md:size-9"
      header={
        <>
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar id={user.id} name={user.name} avatarUpdatedAt={user.avatarUpdatedAt} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-text">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <hr className="my-1 border-border" />
        </>
      }
    >
      <MenuLink to="/perfil" icon={<UserRound size={16} />}>
        Meu perfil
      </MenuLink>
      {user.role === 'admin' && (
        <>
          <MenuSeparator />
          <MenuGroupLabel>Administração</MenuGroupLabel>
          <MenuLink to="/admin/membros" icon={<Users size={16} />}>
            Membros
          </MenuLink>
          <MenuLink to="/admin/convites" icon={<Mail size={16} />}>
            Convites
          </MenuLink>
          <MenuLink to="/admin/workspace" icon={<Building2 size={16} />}>
            Equipe
          </MenuLink>
        </>
      )}
      <MenuSeparator />
      <MenuItem
        onSelect={signOut}
        disabled={pending}
        icon={pending ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}
      >
        {pending ? 'Saindo…' : 'Sair'}
      </MenuItem>
    </Menu>
  );
}
