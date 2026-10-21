import { philippineCityCoordinates } from "../../../../shared/philippine-city-coordinates";
import { apiRequest } from "@/lib/api-request";
import { scheduleAddressSearch } from "@/lib/address-search";
import type { AddressLocation } from "../../../../shared/address-location";
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
  const [lookup, setLookup] = useState<AddressLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const manualVersion = useRef(0);
  const cancelSearch = useRef<(() => void) | null>(null);
  const addressDirty = address.trim() !== provider.location.trim();

  const edited = useRef(false);
  const profileId = useRef(provider.id);
  const cityMatches = currentCity && provider.locationCity && !differsFromSaved;
  const cityCenter = { latitude: provider.cityLatitude ?? (provider.locationAccuracy === "city" ? provider.latitude : null), longitude: provider.cityLongitude ?? (provider.locationAccuracy === "city" ? provider.longitude : null) };
  const center = cityMatches && validCoordinates(cityCenter) ? cityCenter : locality ? philippineCityCoordinates[locality.code] ?? null : null;
  useEffect(() => {
    manualVersion.current++;
    cancelSearch.current?.();
    setLocating(false);
    return () => cancelSearch.current?.();
  }, [address, currentCity, currentProvince, provider.id]);
  const searchAddress = () => {
    if (saving || locating) return;
    if (address.trim().length < 5 || !locality) {
      setMessage("Enter your business address and choose a city or municipality from the suggestions."); return;
    }
    cancelSearch.current?.();
    const version = ++manualVersion.current;
    setLocating(true);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const cancel = scheduleAddressSearch(signal => apiRequest<{ result: AddressLocation | null }>(`${base}/api/provider/location/resolve`, {
      method: "POST", body: JSON.stringify({ address: address.trim(), city: currentCity, province: currentProvince }), signal,
    }), result => {
      if (version !== manualVersion.current) return;
      if (result) {
        if (result.accuracy === "city") {
          // A city is a map overview, never an automatically verified shop marker.
          setLookup(result); setMessage("Exact address not found. Please adjust the pin to your shop's location."); return;
        }
        if (provider.locationAccuracy === "shop" && validCoordinates(provider)) {
          if (result.accuracy !== "building") { setMessage("Exact address not found. Please adjust the pin to your shop's location."); return; }
          const moved = result.latitude !== provider.latitude || result.longitude !== provider.longitude;
          if (moved && !window.confirm("Use the address match instead of your saved shop pin? Your saved location will change only after Save Location.")) {
            setMessage("Your saved shop pin was kept."); return;
          }
        }
        edited.current = true;
        setLookup(result); setPin({ latitude: result.latitude, longitude: result.longitude }); setPinChanged(true);
        setMessage(result.accuracy === "building" ? "Address located. Check the pin, then save your shop location." : "Exact address not found. Please adjust the pin to your shop's location.");
      } else {
        setMessage("Exact address not found. Please adjust the pin to your shop's location.");
      }
    }, () => { if (version === manualVersion.current) setMessage("Exact address not found. Please adjust the pin to your shop's location."); },
    () => { if (version === manualVersion.current) setLocating(false); });
    cancelSearch.current = cancel;
  };
  useEffect(() => {
    // A city-center refresh or background profile refetch must not erase a
    // geocoded preview, edited address, or manually placed unsaved shop pin.
    if (profileId.current === provider.id && edited.current) return;
    profileId.current = provider.id;
    edited.current = false;
    setAddress(provider.location);
    const saved = findPhilippineLocation(provider.locationCity ?? "", provider.locationProvince);
    setCity(saved ? locationLabel(saved) : provider.locationCity ?? "");
    setSelectionChanged(false);
    setPin(provider.locationAccuracy === "shop" && validCoordinates(provider) ? { latitude: provider.latitude, longitude: provider.longitude } : null);
    setPinChanged(false);
    setLookup(null);
  }, [provider.id, provider.location, provider.locationCity, provider.locationProvince, provider.latitude, provider.longitude, provider.locationAccuracy]);
  return <div className="form-field">
    <h2 className="section-title">Business Location</h2>
    <label className="form-label mt-2" htmlFor="provider-business-location">Store / Business Address</label>
    <textarea id="provider-business-location" className="input h-24 resize-y py-3" maxLength={300} value={address} disabled={saving} placeholder="Street / House No. / Building, Barangay, City / Municipality" onChange={event => {
      edited.current = true;
      setAddress(event.target.value);
      const detected = detectPhilippineLocation(event.target.value);
      setCity(detected ? locationLabel(detected) : city); setSelectionChanged(false); setPinChanged(false); setLookup(null); setPin(provider.locationAccuracy === "shop" && validCoordinates(provider) ? { latitude: provider.latitude, longitude: provider.longitude } : null); setMessage("");
    }} />
    {address.trim() ? <>
      <label className="form-label" htmlFor="provider-city">City / Municipality</label>
      <input className="input" id="provider-city" list="provider-city-options" maxLength={150} value={city} disabled={saving} placeholder="Search a Philippine city or municipality" onChange={event => { edited.current = true; setCity(event.target.value); setSelectionChanged(true); setPinChanged(false); setLookup(null); setPin(provider.locationAccuracy === "shop" && validCoordinates(provider) ? { latitude: provider.latitude, longitude: provider.longitude } : null); setMessage(""); }} />
      <datalist id="provider-city-options">{suggestions.map(item => <option key={item.code} value={locationLabel(item)} />)}</datalist>
      {locality?.province ? <p className="text-xs text-muted-foreground">Province: {locality.province}</p> : null}
    </> : null}
    <p className="text-xs text-muted-foreground">Location automatically determined from your city.</p>
    {currentCity ? <p className="text-xs text-muted-foreground">Located in {locality ? locationLabel(locality) : currentCity}</p> : null}
    {currentCity ? <>
      <h3 className="mt-3 font-semibold">Pin Your Pet Shop Location (Optional)</h3>
      <p className="text-sm text-muted-foreground">Zoom in and tap the map to mark your pet shop's exact location.</p>
      {center && !lookup && !pin ? <p className="text-xs text-muted-foreground">Approximate city view. Click the map to place your exact shop pin.</p> : null}
      {locality ? <p className="text-xs text-muted-foreground">City overview: <a className="underline" href="https://data.humdata.org/dataset/cod-ab-phl" target="_blank" rel="noopener noreferrer">PSA/NAMRIA via OCHA HDX</a> (approximate).</p> : null}
      <button className="btn btn-secondary mb-2 self-start" type="button" disabled={saving || locating || address.trim().length < 5 || !locality} onClick={searchAddress}>{locating ? "Searching..." : "Search Address"}</button>
      <ShopPinMap focus={lookup ?? (differsFromSaved && center ? { ...center, zoom: 12 } : null)} center={center} pin={pin} disabled={saving} onSelect={selected => {
        if (validCoordinates(selected)) { edited.current = true; manualVersion.current++; cancelSearch.current?.(); setLocating(false); setLookup(null); setPin(selected); setPinChanged(true); setMessage(""); }
      }} />
      <button className="btn btn-primary mt-2 self-start" type="button" disabled={(!pinChanged && !addressDirty && !selectionChanged) || !address.trim() || !currentCity || saving || locating} onClick={async () => {
        if (selectionChanged && !selectedLocality) { setMessage("Choose a matching city or municipality from the suggestions."); return; }
        if (differsFromSaved && provider.locationAccuracy === "shop" && !pinChanged) { setMessage("Select your shop pin in the new city before saving. Your saved location has been kept."); return; }
        if (lookup && lookup.accuracy !== "building" && !window.confirm("This is an approximate address match. Confirm that the selected pin marks your actual shop, or cancel and adjust it on the map.")) return;
        const confirmChange = differsFromSaved && provider.locationAccuracy === "shop";
        if (confirmChange && !window.confirm("Replace your saved shop pin with the selected location in the new city?")) return;
        try {
          await save({ ...provider, location: address.trim(), locationCity: currentCity, locationProvince: currentProvince, locationSelectionChanged: selectionChanged, locationChangeConfirmed: confirmChange, ...(pinChanged && pin ? { ...pin, shopPinSelected: true, shopPinCity: currentCity } : {}) });
          edited.current = false; setPinChanged(false); setLookup(null); setMessage("Shop location saved.");
        } catch { setMessage("Your shop location could not be saved. Please try again."); }
      }}>{saving ? "Saving..." : "Save Location"}</button>
      <p className="text-xs text-muted-foreground">{lookup ? "Address search suggests a location. Review or adjust the pin before saving." : provider.locationAccuracy === "shop" && !pinChanged ? "Using your saved shop pin." : "Without a saved shop pin, nearby searches use your approximate city location."}</p>
    </> : null}
    {saving || locating || message ? <p className="text-xs text-muted-foreground" role="status">{saving ? "Saving business address..." : locating ? "Finding your business address..." : message}</p> : null}
  </div>;
}
