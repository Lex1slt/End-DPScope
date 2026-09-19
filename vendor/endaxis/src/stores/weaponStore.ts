import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { WeaponInstance, WeaponLevel } from '../types';
import { resolveWeaponSlug } from '../data';
import { getSkillBounds, clampSkillLevel } from '../utils/weaponBounds';

const STORAGE_KEY = 'endfield-weapon-armory';

let _counter = 0;
function generateId(): string {
  return `w_${Date.now()}_${++_counter}`;
}

function loadFromStorage(): WeaponInstance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.state && Array.isArray(parsed.state.weapons)) {
        return parsed.state.weapons.map((weapon: WeaponInstance) => ({
          ...weapon,
          weaponSlug: resolveWeaponSlug(weapon.weaponSlug) || weapon.weaponSlug,
        }));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveToStorage(weapons: WeaponInstance[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { weapons } }));
}

export const useWeaponStore = defineStore('weapons', () => {
  const weapons = ref<WeaponInstance[]>(loadFromStorage());

  function persist() {
    saveToStorage(weapons.value);
  }

  function addWeapon(slug: string): WeaponInstance {
    const resolvedSlug = resolveWeaponSlug(slug) || slug;
    const instance: WeaponInstance = {
      id: generateId(),
      weaponSlug: resolvedSlug,
      level: 1,
      tuned: false,
      potential: 0,
      skill1Level: 1,
      skill2Level: 1,
      skill3Level: 1,
    };
    weapons.value.push(instance);
    persist();
    return instance;
  }

  function importWeapon(data: Omit<WeaponInstance, 'id'>): WeaponInstance {
    const instance: WeaponInstance = {
      id: generateId(),
      ...data,
      weaponSlug: resolveWeaponSlug(data.weaponSlug) || data.weaponSlug,
    };
    weapons.value.push(instance);
    persist();
    return instance;
  }

  function updateWeapon(
    id: string,
    updates: Partial<
      Pick<
        WeaponInstance,
        'level' | 'tuned' | 'potential' | 'skill1Level' | 'skill2Level' | 'skill3Level'
      >
    >,
  ) {
    const w = weapons.value.find(wp => wp.id === id);
    if (!w) return;

    if (updates.level !== undefined) w.level = updates.level;
    if (updates.tuned !== undefined) w.tuned = updates.tuned;

    // When potential changes, shift skill3Level by the same delta so the
    // user's yellow (invested) slots are preserved.
    if (updates.potential !== undefined && updates.potential !== w.potential) {
      const delta = updates.potential - w.potential;
      w.skill3Level += delta;
      w.potential = updates.potential;
    }

    if (updates.skill1Level !== undefined) w.skill1Level = updates.skill1Level;
    if (updates.skill2Level !== undefined) w.skill2Level = updates.skill2Level;
    if (updates.skill3Level !== undefined) w.skill3Level = updates.skill3Level;

    // Normalize tuned for fixed levels
    if (w.level === 1) w.tuned = false;
    if (w.level === 90) w.tuned = true;

    // Clamp skill levels
    const bounds = getSkillBounds(w.level as WeaponLevel, w.tuned, w.potential);
    w.skill1Level = clampSkillLevel(w.skill1Level, bounds.skill1);
    w.skill2Level = clampSkillLevel(w.skill2Level, bounds.skill2);
    w.skill3Level = clampSkillLevel(w.skill3Level, bounds.skill3);

    persist();
  }

  function removeWeapon(id: string) {
    weapons.value = weapons.value.filter(w => w.id !== id);
    persist();
  }

  function clearAll() {
    weapons.value = [];
    persist();
  }

  function setAll(instances: WeaponInstance[]) {
    weapons.value = JSON.parse(JSON.stringify(instances)).map((weapon: WeaponInstance) => ({
      ...weapon,
      weaponSlug: resolveWeaponSlug(weapon.weaponSlug) || weapon.weaponSlug,
    }));
    persist();
  }

  return { weapons, addWeapon, importWeapon, updateWeapon, removeWeapon, clearAll, setAll };
});
