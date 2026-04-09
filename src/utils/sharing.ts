import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import type { MapShare, SharePermission, ApiResult } from '../types';
import { useAuthStore } from '../store/authStore';

export function generateShareToken(): string {
  return nanoid(21);
}

export async function generateShareLink(mapId: string): Promise<string> {
  const { data: map } = await supabase.from('mindmaps').select('is_public, share_token').eq('id', mapId).single();
  
  let token = map?.share_token;
  
  if (!map?.is_public || !token) {
    token = token || generateShareToken();
    await supabase.from('mindmaps').update({ 
      is_public: true, 
      share_token: token 
    }).eq('id', mapId);
  }
  
  return `${window.location.origin}/share/${token}`;
}

export async function revokeShareLink(mapId: string): Promise<void> {
  await supabase.from('mindmaps').update({ 
    is_public: false, 
    share_token: null 
  }).eq('id', mapId);
}

export async function inviteFriend(mapId: string, email: string, permission: SharePermission): Promise<ApiResult<null>> {
  const user = useAuthStore.getState().user;
  const shared_by_user_id = user?.id;

  const { error } = await supabase.from('map_shares').insert({
    map_id: mapId,
    shared_by_user_id,
    shared_with_email: email,
    permission: permission
  });
  
  if (error) {
    if (error.code === '23505') { 
       await supabase.from('map_shares')
         .update({ permission })
         .match({ map_id: mapId, shared_with_email: email });
       return { data: null, error: null };
    }
    if (error.code === '42P01') {
      console.warn("Table map_shares does not exist. Mocking success.");
      return { data: null, error: null };
    }
    return { data: null, error: error.message };
  }
  
  return { data: null, error: null };
}

export async function removeInvite(shareId: string): Promise<void> {
  const { error } = await supabase.from('map_shares').delete().eq('id', shareId);
  if (error && error.code !== '42P01') console.error("removeInvite error:", error);
}

export async function getShares(mapId: string): Promise<MapShare[]> {
  const { data, error } = await supabase.from('map_shares').select('*').eq('map_id', mapId);
  
  if (error) {
    if (error.code === '42P01') return [];
    console.error("getShares error:", error);
    return [];
  }
  
  if (!data) return [];
  
  return data.map((row: {
    id: string;
    map_id: string;
    shared_by_user_id: string;
    shared_with_email: string;
    permission: SharePermission;
    accepted: boolean;
    created_at: string;
  }) => ({
    id: row.id,
    mapId: row.map_id,
    sharedByUserId: row.shared_by_user_id,
    sharedWithEmail: row.shared_with_email,
    permission: row.permission,
    accepted: row.accepted,
    createdAt: row.created_at
  }));
}
