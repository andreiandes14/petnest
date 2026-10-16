/** Join only pets whose ID and owner match the provider-authorized history record. */
export function withRecordPetNames<T extends { petId: number; ownerId: string }>(records: readonly T[],
  pets: readonly { id: number; ownerId: string; name?: string }[]) {
  const names = new Map(pets.map(pet => [JSON.stringify([pet.id, pet.ownerId]), pet.name?.trim()]));
  return records.map(record => ({ ...record,
    petName: names.get(JSON.stringify([record.petId, record.ownerId])) || "Pet name unavailable",
  }));
}
