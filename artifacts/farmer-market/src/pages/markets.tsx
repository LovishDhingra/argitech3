import { useState, useCallback } from "react";
import {
  useListMarkets,
  useListMarketStates,
  useGetNearbyMarkets,
  useRecommendMarkets,
  useListPricesCrops,
  type MarketRecommendation,
  type NearbyMarket,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import MarketMap from "@/components/markets/MarketMap";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  MapPin, Navigation, TrendingUp, Crosshair, Map,
  Loader2, LocateFixed, AlertCircle, Search,
} from "lucide-react";

const FRONTEND_STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  "Punjab": { lat: 31.1471, lng: 75.3412 },
  "Bihar": { lat: 25.0961, lng: 85.3131 },
  "NCT of Delhi": { lat: 28.7041, lng: 77.1025 },
  "Maharashtra": { lat: 19.7515, lng: 75.7139 },
  "Gujarat": { lat: 22.2587, lng: 71.1924 },
  "Rajasthan": { lat: 27.0238, lng: 74.2179 },
  "Telangana": { lat: 18.1124, lng: 79.0193 },
  "Madhya Pradesh": { lat: 22.9734, lng: 78.6569 },
  "Haryana": { lat: 29.0588, lng: 76.0856 },
  "Uttar Pradesh": { lat: 26.8467, lng: 80.9462 },
  "Karnataka": { lat: 15.3173, lng: 75.7139 },
  "Tamil Nadu": { lat: 11.1271, lng: 78.6569 },
  "Andhra Pradesh": { lat: 15.9129, lng: 79.7400 },
  "West Bengal": { lat: 22.9868, lng: 87.8550 },
  "Keralam": { lat: 10.8505, lng: 76.2711 },
  "Odisha": { lat: 20.9517, lng: 85.0985 },
};

type GpsState = "idle" | "detecting" | "found" | "denied" | "error";

export default function Markets() {
  const [selectedCrop, setSelectedCrop] = useState("Wheat");
  const [selectedState, setSelectedState] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"both" | "map" | "list">("both");

  const { data: statesData, isLoading: statesLoading } = useListMarketStates();
  const { data: cropsData } = useListPricesCrops();

  const cropsFallback = ["Wheat", "Paddy(Common)", "Cotton", "Maize", "Soyabean", "Mustard", "Bengal Gram(Gram)(Whole)", "Onion", "Tomato", "Apple", "Brinjal", "Pumpkin"];
  const crops = cropsData?.crops || cropsFallback;

  const { data: markets, isLoading: marketsLoading } = useListMarkets(
    selectedState !== "all" ? { state: selectedState } : {},
    { query: { enabled: true } },
  );

  const { data: nearbyMarkets, isLoading: nearbyLoading } = useGetNearbyMarkets(
    userCoords ? { lat: userCoords.lat, lng: userCoords.lng, radius: 200 } : { lat: 0, lng: 0 },
    { query: { enabled: !!userCoords } },
  );

  const {
    data: recommendations,
    isLoading: recommendLoading,
    refetch,
  } = useRecommendMarkets(
    { crop: selectedCrop, location: selectedState !== "all" ? selectedState : "India" },
    { query: { enabled: false } },
  );

  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState("error");
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsState("detecting");
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsState("found");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsState("denied");
          setGpsError("Location permission denied. Please allow access in your browser settings.");
        } else {
          setGpsState("error");
          setGpsError("Could not detect location. Please try again.");
        }
      },
      { timeout: 10000 },
    );
  }, []);

  const handleFindMarkets = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    refetch();
  };

  const filteredMarkets = (markets ?? []).filter((m) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.district.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Market Finder</h1>
        <p className="text-muted-foreground mt-1">
          Find the best mandis across India to sell your crops for maximum profit.
        </p>
      </div>

      {/* ── Search form ─────────────────────────────────────────────────── */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <form onSubmit={handleFindMarkets} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1 w-full">
              <Label className="text-primary font-semibold">Your Crop</Label>
              <Select value={selectedCrop} onValueChange={setSelectedCrop}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select crop" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {crops.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex-1 w-full">
              <Label className="text-primary font-semibold">Your State</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All India</SelectItem>
                  {statesLoading ? (
                    <SelectItem value="_loading" disabled>Loading states…</SelectItem>
                  ) : (
                    (statesData?.states ?? []).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto font-bold h-10 px-8"
              size="lg"
              disabled={!selectedCrop || recommendLoading}
            >
              {recommendLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching…</>
              ) : (
                <><TrendingUp className="h-4 w-4 mr-2" />Find Best Markets</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── GPS Location Detector ─────────────────────────────────────── */}
      <Card className={`border-2 transition-colors ${
        gpsState === "found" ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" :
        gpsState === "denied" || gpsState === "error" ? "border-red-400/50 bg-red-50/50 dark:bg-red-950/20" :
        "border-dashed border-muted-foreground/30"
      }`}>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full mt-0.5 ${
                gpsState === "found" ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"
              }`}>
                <LocateFixed className={`h-5 w-5 ${
                  gpsState === "found" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                }`} />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {gpsState === "idle" && "Detect My Location"}
                  {gpsState === "detecting" && "Detecting location…"}
                  {gpsState === "found" && "Location detected!"}
                  {gpsState === "denied" && "Location access denied"}
                  {gpsState === "error" && "Could not detect location"}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {gpsState === "idle" && "Allow your browser to find mandis nearest to you automatically."}
                  {gpsState === "detecting" && "Please allow location access in your browser…"}
                  {gpsState === "found" && userCoords && (
                    `GPS: ${userCoords.lat.toFixed(4)}°N, ${userCoords.lng.toFixed(4)}°E — showing mandis within 200 km`
                  )}
                  {(gpsState === "denied" || gpsState === "error") && gpsError}
                </p>
              </div>
            </div>

            {gpsState !== "found" && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                <Button
                  variant="outline"
                  onClick={handleDetectLocation}
                  disabled={gpsState === "detecting"}
                  className="shrink-0 font-medium"
                >
                  {gpsState === "detecting" ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Detecting…</>
                  ) : (
                    <><Crosshair className="h-4 w-4 mr-2" />Use My Location</>
                  )}
                </Button>
                
                <span className="text-xs text-muted-foreground text-center self-center font-medium">or</span>
                
                <Select onValueChange={(val) => {
                  const coords = FRONTEND_STATE_COORDS[val];
                  if (coords) {
                    setUserCoords(coords);
                    setGpsState("found");
                  }
                }}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-background">
                    <SelectValue placeholder="Set State Manually" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {Object.keys(FRONTEND_STATE_COORDS).sort().map((stateName) => (
                      <SelectItem key={stateName} value={stateName}>{stateName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {gpsState === "found" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setUserCoords(null); setGpsState("idle"); }}
                className="shrink-0 text-muted-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Nearby Mandis (GPS result) ────────────────────────────────── */}
      {gpsState === "found" && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Navigation className="h-5 w-5 text-green-600" />
              Mandis Near You
            </h2>
            {userCoords && nearbyMarkets && nearbyMarkets.length > 0 && (
              <div className="inline-flex rounded-lg border p-0.5 bg-muted/50 self-start sm:self-auto text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setViewMode("both")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    viewMode === "both"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Split View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    viewMode === "map"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Map Only
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    viewMode === "list"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  List Only
                </button>
              </div>
            )}
          </div>

          {nearbyLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : nearbyMarkets && nearbyMarkets.length > 0 ? (
            <div className="space-y-4">
              {/* Map Visualization */}
              {userCoords && (viewMode === "both" || viewMode === "map") && (
                <MarketMap userCoords={userCoords} markets={nearbyMarkets} />
              )}

              {/* List View */}
              {(viewMode === "both" || viewMode === "list") && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {nearbyMarkets.map((m: NearbyMarket) => (
                    <Card key={m.id} className="hover-elevate transition-all border-l-4 border-l-green-500">
                      <CardContent className="p-4 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{m.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {m.district}, {m.state}
                          </p>
                          <Badge variant="outline" className="text-xs mt-2 font-normal capitalize">{m.type}</Badge>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">{m.distanceKm} km</div>
                          <div className="text-xs text-muted-foreground">away</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Card className="p-6 text-center text-muted-foreground flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4" />
              No mandis found within 200 km of your location.
            </Card>
          )}
        </div>
      )}

      {/* ── Top Recommendations ───────────────────────────────────────── */}
      {hasSearched && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-secondary" />
            Top Markets for {selectedCrop}
            {selectedState !== "all" && ` in ${selectedState}`}
          </h2>

          {recommendLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 w-full" />)}
            </div>
          ) : recommendations && recommendations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.slice(0, 6).map((rec: MarketRecommendation, index: number) => (
                <Card
                  key={`${rec.market}-${index}`}
                  className={`relative overflow-hidden hover-elevate transition-all border-t-4 ${
                    index === 0 ? "border-t-primary" : index === 1 ? "border-t-secondary" : "border-t-muted"
                  }`}
                >
                  {index === 0 && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-bl-lg z-10">
                      BEST PRICE
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-tight">{rec.market}</CardTitle>
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {rec.district}, {rec.state}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Avg. Modal Price</div>
                        <div className="text-2xl font-bold font-mono text-primary">₹{rec.modalPrice.toLocaleString("en-IN")}</div>
                        <div className="text-xs text-muted-foreground">/quintal</div>
                      </div>
                      <div className="text-right">
                        {rec.premiumOverMsp !== null && (
                          <Badge
                            variant={rec.premiumOverMsp >= 0 ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {rec.premiumOverMsp >= 0 ? "+" : ""}{rec.premiumOverMsp}% MSP
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="bg-muted/50 p-2.5 rounded-md text-xs border">
                      <span className="text-muted-foreground">{rec.reason}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${rec.score}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{rec.score}/100</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              No data found for {selectedCrop}. Try a different crop.
            </Card>
          )}
        </div>
      )}

      {/* ── All Mandis Table ──────────────────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Map className="h-5 w-5 text-muted-foreground" />
            All Mandis
            {selectedState !== "all" && ` — ${selectedState}`}
            <Badge variant="secondary" className="font-normal text-xs">
              {filteredMarkets.length}
            </Badge>
          </h2>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search mandi, city, district or state…"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {marketsLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filteredMarkets.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Market Name</TableHead>
                      <TableHead>District</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMarkets.map((market) => (
                      <TableRow key={market.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground">{market.name}</TableCell>
                        <TableCell className="text-muted-foreground">{market.district}</TableCell>
                        <TableCell className="text-muted-foreground">{market.state}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={market.type === "e-NAM" ? "default" : "outline"}
                            className="font-normal capitalize text-xs"
                          >
                            {market.type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No mandis match your search.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
