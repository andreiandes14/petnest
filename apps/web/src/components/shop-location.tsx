import { useEffect, useRef, useState } from "react";
import type { ProviderDetail } from "@workspace/api-client-react";
import { ShopPinMap } from "./shop-pin-map";
import { validCoordinates, type Coordinates } from "@/lib/nearby-providers";
import { detectCity, normalizeCity } from "../../../../shared/city-location";

export function BusinessLocation({ provider, save, saving }: {
  provider: ProviderDetail;
  save: (profile: ProviderDetail & { shopPinSelected?: boolean; shopPinCity?: string; locationRetry?: boolean }) => Promise<unknown>;
  saving: boolean;
}) {
  const [address, setAddress] = useState(provider.location);
  const [city, setCity] = useState(provider.locationCity ?? "");
  const [message, setMessage] = useState("");
  const detectedCity = detectCity(address);
  const currentCity = detectedCity || city.trim();
  const [pin, setPin] = useState<Coordinates | null>(null);
  const [pinChanged, setPinChanged] = useState(false);
  const attempted = useRef("");
  const saveCallback = useRef(save);
  saveCallback.current = save;
  const cityMatches = currentCity && provider.locationCity && normalizeCity(currentCity) === normalizeCity(provider.locationCity);
  const cityCenter = { latitude: provider.cityLatitude ?? (provider.locationAccuracy === "city" ? provider.latitude : null), longitude: provider.cityLongitude ?? (provider.locationAccuracy === "city" ? provider.longitude : null) };
  const center = cityMatches && validCoordinates(cityCenter) ? cityCenter : null;
  useEffect(() => {
    if (!currentCity || center || saving || address.trim() !== provider.location.trim()) return;
    const key = `${provider.id}:${normalizeCity(currentCity)}:${provider.location}`;
    if (attempted.current === key) return;
    attempted.current = key;
    void saveCallback.current({ ...provider, locationCity: currentCity }).catch(() => setMessage("Your city couldn't be located. Retry or use the map to place your shop pin."));
  }, [currentCity, center?.latitude, center?.longitude, provider.id, provider.location, saving]);
  useEffect(() => {
    setAddress(provider.location);
    setCity(provider.locationCity ?? "");
    setPin(provider.locationAccuracy === "shop" && validCoordinates(provider) ? { latitude: provider.latitude, longitude: provider.longitude } : null);
    setPinChanged(false);
  }, [provider.id, provider.location, provider.locationCity, provider.latitude, provider.longitude, provider.locationAccuracy]);
  const saveAddress = async () => {
    try {
      await save({ ...provider, location: address.trim(), locationCity: detectedCity || city.trim() || null, locationRetry: true });
      setMessage("Business address saved.");
    } catch { setMessage("Your address could not be saved. Please try again."); }
  };
  return <div className="form-field">
    <h2 className="section-title">Business Location</h2>
    <label className="form-label mt-2" htmlFor="provider-business-location">Store / Business Address</label>
    <textarea id="provider-business-location" className="input h-24 resize-y py-3" maxLength={300} value={address} disabled={saving} placeholder="Street / House No. / Building, Barangay, City / Municipality" onChange={event => {
      setAddress(event.target.value); setCity(""); setPin(null); setPinChanged(false); setMessage("");
    }} onBlur={saveAddress} />
    {!detectedCity && address.trim() ? <>
      <label className="form-label" htmlFor="provider-city">City / Municipality</label>
      <input className="input" id="provider-city" list="provider-city-options" maxLength={100} value={city} disabled={saving} placeholder="Select or enter your City / Municipality" onChange={event => { setCity(event.target.value); setPin(null); setPinChanged(false); setMessage(""); }} onBlur={saveAddress} />
      <datalist id="provider-city-options">{["Muntinlupa City", "Makati City", "Quezon City", "Manila City", "Pasig City", "Taguig City", "Las Pi\u00f1as City", "Para\u00f1aque City"].map(name => <option key={name} value={name} />)}</datalist>
    </> : null}
    <p className="text-xs text-muted-foreground">Location automatically determined from your city.</p>
    {detectedCity || city ? <p className="text-xs text-muted-foreground">Located in {detectedCity || city}</p> : null}
    {currentCity ? <>
      <h3 className="mt-3 font-semibold">Pin Your Pet Shop Location (Optional)</h3>
      <p className="text-sm text-muted-foreground">Zoom in and tap the map to mark your pet shop's exact location.</p>
      {!center ? <>
        <p className="text-sm text-muted-foreground">{pin ? "Showing your saved shop pin while the city location is unavailable." : "City search is unavailable. The map shows a world overview, not a guessed city. Navigate to your shop and tap to place its pin, or retry city search."}</p>
        <button className="btn btn-ghost self-start" type="button" disabled={saving} onClick={saveAddress}>Retry City Location</button>
      </> : null}
      <ShopPinMap center={center} pin={pin} disabled={saving} onSelect={selected => {
        if (validCoordinates(selected)) { setPin(selected); setPinChanged(true); setMessage(""); }
      }} />
      <button className="btn btn-primary mt-2 self-start" type="button" disabled={!pinChanged || !pin || saving} onClick={async () => {
        if (!pin) return;
        try {
          await save({ ...provider, location: address.trim(), locationCity: currentCity, ...pin, shopPinSelected: true, shopPinCity: currentCity });
          setPinChanged(false); setMessage("Shop location saved.");
        } catch { setMessage("Your shop location could not be saved. Please try again."); }
      }}>{saving ? "Saving..." : "Save Location"}</button>
      <p className="text-xs text-muted-foreground">{provider.locationAccuracy === "shop" && !pinChanged ? "Using your saved shop pin." : "Without a saved shop pin, nearby searches use your approximate city location."}</p>
    </> : null}
    {saving || message ? <p className="text-xs text-muted-foreground" role="status">{saving ? "Saving business address..." : message}</p> : null}
  </div>;
}
