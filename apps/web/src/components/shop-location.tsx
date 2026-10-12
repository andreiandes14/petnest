import { useEffect, useRef, useState } from "react";
import type { ProviderDetail } from "@workspace/api-client-react";
import { ShopPinMap } from "./shop-pin-map";
import { validCoordinates, type Coordinates } from "@/lib/nearby-providers";
import { detectPhilippineLocation, findPhilippineLocation, locationLabel, searchPhilippineLocations } from "../../../../shared/philippine-locations";
import { detectCity, normalizeCity } from "../../../../shared/city-location";

export function BusinessLocation({ provider, save, saving }: {
  provider: ProviderDetail;
  save: (profile: ProviderDetail & { shopPinSelected?: boolean; shopPinCity?: string; locationRetry?: boolean; locationSelectionChanged?: boolean; locationChangeConfirmed?: boolean }) => Promise<unknown>;
  saving: boolean;
}) {
  const [address, setAddress] = useState(provider.location);
  const savedLocality = findPhilippineLocation(provider.locationCity ?? "", provider.locationProvince);
  const [city, setCity] = useState(savedLocality ? locationLabel(savedLocality) : provider.locationCity ?? "");
  const [selectionChanged, setSelectionChanged] = useState(false);
  const [message, setMessage] = useState("");
  const detectedLocality = detectPhilippineLocation(address);
  const selectedLocality = findPhilippineLocation(city);
  const locality = selectionChanged ? selectedLocality : selectedLocality || detectedLocality;
  const detectedCity = detectedLocality?.name || detectCity(address);
  const currentCity = locality?.name || detectedCity || "";
  const currentProvince = locality?.province ?? null;
  const suggestions = searchPhilippineLocations(city);
  const differsFromSaved = Boolean(currentCity && provider.locationCity && (normalizeCity(currentCity) !== normalizeCity(provider.locationCity) || (currentProvince && provider.locationProvince && currentProvince !== provider.locationProvince)));
  const [pin, setPin] = useState<Coordinates | null>(null);
  const [pinChanged, setPinChanged] = useState(false);
  const attempted = useRef("");
  const saveCallback = useRef(save);
  saveCallback.current = save;
  const cityMatches = currentCity && provider.locationCity && !differsFromSaved;
  const cityCenter = { latitude: provider.cityLatitude ?? (provider.locationAccuracy === "city" ? provider.latitude : null), longitude: provider.cityLongitude ?? (provider.locationAccuracy === "city" ? provider.longitude : null) };
  const center = cityMatches && validCoordinates(cityCenter) ? cityCenter : null;
  useEffect(() => {
    if (!currentCity || selectionChanged || center || saving || differsFromSaved || address.trim() !== provider.location.trim()) return;
    const key = `${provider.id}:${normalizeCity(currentCity)}:${provider.location}`;
    if (attempted.current === key) return;
    attempted.current = key;
    void saveCallback.current({ ...provider, locationCity: currentCity, locationProvince: currentProvince }).catch(() => setMessage("Your city couldn't be located. Retry or use the map to place your shop pin."));
  }, [currentCity, currentProvince, selectionChanged, differsFromSaved, center?.latitude, center?.longitude, provider.id, provider.location, saving]);
  useEffect(() => {
    setAddress(provider.location);
    const saved = findPhilippineLocation(provider.locationCity ?? "", provider.locationProvince);
    setCity(saved ? locationLabel(saved) : provider.locationCity ?? "");
    setSelectionChanged(false);
    setPin(provider.locationAccuracy === "shop" && validCoordinates(provider) ? { latitude: provider.latitude, longitude: provider.longitude } : null);
    setPinChanged(false);
  }, [provider.id, provider.location, provider.locationCity, provider.locationProvince, provider.latitude, provider.longitude, provider.locationAccuracy]);
  const saveAddress = async () => {
    if (!currentCity && provider.locationAccuracy === "shop") { setMessage("Choose the city or municipality before changing your saved shop location."); return; }
    if (selectionChanged && !selectedLocality) { setMessage("Choose a matching city or municipality from the suggestions."); return; }
    const confirmChange = differsFromSaved && provider.locationAccuracy === "shop";
    if (confirmChange && !window.confirm("Changing your city will replace the saved shop pin with an approximate city location. Continue?")) return;
    try {
      await save({ ...provider, location: address.trim(), locationCity: currentCity || null, locationProvince: currentProvince, locationSelectionChanged: selectionChanged, locationChangeConfirmed: confirmChange, locationRetry: true });
      setMessage("Business address saved.");
    } catch { setMessage("Your address could not be saved. Please try again."); }
  };
  return <div className="form-field">
    <h2 className="section-title">Business Location</h2>
    <label className="form-label mt-2" htmlFor="provider-business-location">Store / Business Address</label>
    <textarea id="provider-business-location" className="input h-24 resize-y py-3" maxLength={300} value={address} disabled={saving} placeholder="Street / House No. / Building, Barangay, City / Municipality" onChange={event => {
      setAddress(event.target.value);
      const detected = detectPhilippineLocation(event.target.value);
      setCity(detected ? locationLabel(detected) : ""); setSelectionChanged(false); setPinChanged(false); setMessage("");
    }} onBlur={saveAddress} />
    {address.trim() ? <>
      <label className="form-label" htmlFor="provider-city">City / Municipality</label>
      <input className="input" id="provider-city" list="provider-city-options" maxLength={150} value={city} disabled={saving} placeholder="Search a Philippine city or municipality" onChange={event => { setCity(event.target.value); setSelectionChanged(true); setPinChanged(false); setMessage(""); }} onBlur={saveAddress} />
      <datalist id="provider-city-options">{suggestions.map(item => <option key={item.code} value={locationLabel(item)} />)}</datalist>
      {locality?.province ? <p className="text-xs text-muted-foreground">Province: {locality.province}</p> : null}
    </> : null}
    <p className="text-xs text-muted-foreground">Location automatically determined from your city.</p>
    {currentCity ? <p className="text-xs text-muted-foreground">Located in {locality ? locationLabel(locality) : currentCity}</p> : null}
    {currentCity ? <>
      <h3 className="mt-3 font-semibold">Pin Your Pet Shop Location (Optional)</h3>
      <p className="text-sm text-muted-foreground">Zoom in and tap the map to mark your pet shop's exact location.</p>
      {!center ? <>
        <p className="text-sm text-muted-foreground">{pin ? "Showing your saved shop pin while the city location is unavailable." : "City search is unavailable. The map shows a world overview, not a guessed city. Navigate to your shop and tap to place its pin, or retry city search."}</p>
        <button className="btn btn-ghost self-start" type="button" disabled={saving} onClick={saveAddress}>Retry City Location</button>
      </> : null}
      <ShopPinMap center={center} pin={differsFromSaved && !pinChanged ? null : pin} disabled={saving} onSelect={selected => {
        if (validCoordinates(selected)) { setPin(selected); setPinChanged(true); setMessage(""); }
      }} />
      <button className="btn btn-primary mt-2 self-start" type="button" disabled={!pinChanged || !pin || saving} onClick={async () => {
        if (!pin) return;
        const confirmChange = differsFromSaved && provider.locationAccuracy === "shop";
        if (confirmChange && !window.confirm("Replace your saved shop pin with the selected location in the new city?")) return;
        try {
          await save({ ...provider, location: address.trim(), locationCity: currentCity, locationProvince: currentProvince, locationSelectionChanged: selectionChanged, locationChangeConfirmed: confirmChange, ...pin, shopPinSelected: true, shopPinCity: currentCity });
          setPinChanged(false); setMessage("Shop location saved.");
        } catch { setMessage("Your shop location could not be saved. Please try again."); }
      }}>{saving ? "Saving..." : "Save Location"}</button>
      <p className="text-xs text-muted-foreground">{provider.locationAccuracy === "shop" && !pinChanged ? "Using your saved shop pin." : "Without a saved shop pin, nearby searches use your approximate city location."}</p>
    </> : null}
    {saving || message ? <p className="text-xs text-muted-foreground" role="status">{saving ? "Saving business address..." : message}</p> : null}
  </div>;
}
