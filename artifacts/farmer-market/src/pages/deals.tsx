import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useListPricesCrops } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Handshake, Plus, Search, MapPin, Phone, Users, CheckCircle,
  MessageSquare, Calendar, Trash2, X, Sparkles, TrendingDown, Info, ShieldAlert
} from "lucide-react";

interface Deal {
  id: string;
  title: string;
  category: "bulk_supply" | "group_buying" | "machinery_rental" | "contracts";
  item: string;
  price: string;
  quantity: string;
  location: string;
  state: string;
  contactName: string;
  contactPhone: string;
  description: string;
  createdAt: string;
  isUserCreated?: boolean;
  poolFilled?: number; // for group buying, percentage
  poolTarget?: number; // target bags/tons
}

const INITIAL_DEALS: Deal[] = [
  {
    id: "deal-1",
    title: "Bulk Paddy(Common) Supply - Direct Sale",
    category: "bulk_supply",
    item: "Paddy(Common)",
    price: "₹2,100 / quintal",
    quantity: "45 Tons (450 quintals)",
    location: "Rajpura Mandi",
    state: "Punjab",
    contactName: "Sardar Baldev Singh",
    contactPhone: "98765-43210",
    description: "Premium long-grain Paddy harvested last week. Moister content is strictly under 14%. Direct delivery to rice mills in Rajpura region preferred.",
    createdAt: "2026-07-06",
    poolFilled: 0,
  },
  {
    id: "deal-2",
    title: "Group Buy: DAP Fertilizer Bulk Discount",
    category: "group_buying",
    item: "DAP Fertilizer",
    price: "₹1,150 / bag",
    quantity: "Need 80 more bags for 20% truck discount",
    location: "Karnal Co-op Hub",
    state: "Haryana",
    contactName: "Ramesh Choudhary",
    contactPhone: "94160-55122",
    description: "Co-ordering a full truckload of high-quality DAP fertilizer directly from the distributor. Current market retail is ₹1,350. By joining, we pay only ₹1,150 per bag.",
    createdAt: "2026-07-07",
    poolFilled: 65,
    poolTarget: 200,
  },
  {
    id: "deal-3",
    title: "Shared Combined Harvester Rental Split",
    category: "machinery_rental",
    item: "Harvester Rental",
    price: "₹1,400 / acre",
    quantity: "July 12th to July 18th",
    location: "Mullanpur Sector",
    state: "Punjab",
    contactName: "Gurnam Dhillon",
    contactPhone: "99144-88339",
    description: "Renting a modern John Deere harvester. Normal individual rate is ₹1,800/acre. Since we have adjacent fields totaling 80 acres, we got a group discount of ₹1,400. Need 2 more farmers to participate.",
    createdAt: "2026-07-05",
    poolFilled: 80,
  },
  {
    id: "deal-4",
    title: "Wholesale Contract: Organic Tomatoes",
    category: "contracts",
    item: "Tomato",
    price: "₹22 / kg fixed rate",
    quantity: "3 Tons/week for 4 months",
    location: "Indore Fruit & Veg Mandi",
    state: "Madhya Pradesh",
    contactName: "FreshBasket Organics (Kunal)",
    contactPhone: "88270-11904",
    description: "Looking for 3-4 farmers who can commit to supplying high quality organic tomatoes. We provide organic seed certified guidance and buy at a guaranteed fixed rate of ₹22/kg, regardless of mandi drops.",
    createdAt: "2026-07-07",
    poolFilled: 40,
  },
  {
    id: "deal-5",
    title: "Bulk Sweet Onion Supply",
    category: "bulk_supply",
    item: "Onion",
    price: "₹1,800 / quintal",
    quantity: "15 Tons",
    location: "Lasalgaon Mandi",
    state: "Maharashtra",
    contactName: "Anil Shinde",
    contactPhone: "98220-77665",
    description: "Well-dried Nashik pink onions ready for storage or direct delivery. Grade A size, fully cured. Selling below normal retail for instant warehouse clearance.",
    createdAt: "2026-07-06",
    poolFilled: 0,
  },
  {
    id: "deal-6",
    title: "Joint Seeds Purchase: Basmati CSR 30",
    category: "group_buying",
    item: "Paddy Seeds",
    price: "₹85 / kg",
    quantity: "Seeking partners for 500kg minimum",
    location: "Jalandhar Seed Agency",
    state: "Punjab",
    contactName: "Harpreet Brar",
    contactPhone: "98150-12345",
    description: "Basmati seed CSR-30 original government certified stock. Bulking up our purchase to get dealer rates. Regular price is ₹110/kg. Let's order together.",
    createdAt: "2026-07-07",
    poolFilled: 30,
    poolTarget: 500,
  }
];

export default function Deals() {
  const { user } = useUser();
  const { toast } = useToast();
  const { data: cropsData } = useListPricesCrops();

  const [deals, setDeals] = useState<Deal[]>(() => {
    const saved = localStorage.getItem("farm_sphere_deals");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_DEALS;
      }
    }
    return INITIAL_DEALS;
  });

  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [selectedState, setSelectedState] = useState("All");

  // Contact Modal State
  const [contactingDeal, setContactingDeal] = useState<Deal | null>(null);
  const [inquiryText, setInquiryText] = useState("");

  // New Deal Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<"bulk_supply" | "group_buying" | "machinery_rental" | "contracts">("bulk_supply");
  const [newItem, setNewItem] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newState, setNewState] = useState("Punjab");
  const [newPhone, setNewPhone] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    localStorage.setItem("farm_sphere_deals", JSON.stringify(deals));
  }, [deals]);

  const handlePostDeal = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTitle || !newItem || !newPrice || !newQuantity || !newLocation || !newPhone || !newDesc) {
      toast({
        title: "Incomplete Form",
        description: "Please fill out all the required fields to post your deal.",
        variant: "destructive"
      });
      return;
    }

    const userName = user?.fullName || user?.firstName || "Kisan Mitra";

    const customDeal: Deal = {
      id: `custom-${Date.now()}`,
      title: newTitle,
      category: newCategory,
      item: newItem,
      price: newPrice,
      quantity: newQuantity,
      location: newLocation,
      state: newState,
      contactName: userName,
      contactPhone: newPhone,
      description: newDesc,
      createdAt: new Date().toISOString().split("T")[0],
      isUserCreated: true,
      poolFilled: newCategory === "group_buying" ? 10 : undefined,
      poolTarget: newCategory === "group_buying" ? 100 : undefined,
    };

    setDeals([customDeal, ...deals]);
    setIsNewDealOpen(false);

    // Reset Form
    setNewTitle("");
    setNewItem("");
    setNewPrice("");
    setNewQuantity("");
    setNewLocation("");
    setNewPhone("");
    setNewDesc("");

    toast({
      title: "Deal Posted Successfully! 🎉",
      description: "Your farmer deal is now live on the Farm Sphere dashboard feed.",
    });
  };

  const handleDeleteDeal = (id: string) => {
    setDeals(deals.filter((d) => d.id !== id));
    toast({
      title: "Deal Removed",
      description: "Your custom deal was successfully deleted."
    });
  };

  const handleSendInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryText.trim()) return;

    toast({
      title: "Inquiry Sent! 📬",
      description: `Your interest in "${contactingDeal?.title}" has been shared. ${contactingDeal?.contactName} will reach out to you shortly.`,
    });

    setContactingDeal(null);
    setInquiryText("");
  };

  // Filter Deals
  const filteredDeals = deals.filter((deal) => {
    // Category Tab Filter
    if (activeTab !== "all" && deal.category !== activeTab) return false;

    // State Filter
    if (selectedState !== "All" && deal.state !== selectedState) return false;

    // Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        deal.title.toLowerCase().includes(q) ||
        deal.item.toLowerCase().includes(q) ||
        deal.location.toLowerCase().includes(q) ||
        deal.state.toLowerCase().includes(q) ||
        deal.contactName.toLowerCase().includes(q)
      );
    }

    return true;
  });

  const cropsFallback = ["Wheat", "Paddy(Common)", "Cotton", "Maize", "Soyabean", "Mustard", "Bengal Gram(Gram)(Whole)", "Onion", "Tomato", "Apple", "Brinjal", "Pumpkin"];
  const allCrops = cropsData?.crops || cropsFallback;

  // Compute Statistics
  const stats = {
    totalActive: deals.length,
    bulkVolume: "78 Tons",
    collectiveSavings: "₹1,24,000",
    contractsActive: deals.filter(d => d.category === "contracts").length,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Farmer Deals Hub</h1>
          <p className="text-muted-foreground mt-1">
            Buy, sell, share machinery, and team up with other farmers to purchase agricultural inputs at bulk discounts.
          </p>
        </div>
        <Button onClick={() => setIsNewDealOpen(true)} className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="h-4 w-4" />
          Post a New Deal
        </Button>
      </div>

      {/* ── Statistics Grid ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card shadow-sm border border-border/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Handshake className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active Community Deals</p>
              <h3 className="text-2xl font-bold font-mono text-foreground mt-0.5">{stats.totalActive}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border border-border/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Collective Savings Pooled</p>
              <h3 className="text-2xl font-bold font-mono text-foreground mt-0.5">{stats.collectiveSavings}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border border-border/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <TrendingDown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Bulk Supply Listed</p>
              <h3 className="text-2xl font-bold font-mono text-foreground mt-0.5">{stats.bulkVolume}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border border-border/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Contracts Awaiting Bid</p>
              <h3 className="text-2xl font-bold font-mono text-foreground mt-0.5">{stats.contractsActive}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Controls ─────────────────────────────────────────── */}
      <Card className="bg-card border/60 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            {[
              { id: "all", label: "All Deals" },
              { id: "bulk_supply", label: "🌾 Bulk Supply" },
              { id: "group_buying", label: "📦 Group buying" },
              { id: "machinery_rental", label: "🚜 Machinery Sharing" },
              { id: "contracts", label: "🤝 Wholesale Contracts" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Inputs */}
          <div className="flex gap-2 w-full md:w-auto md:max-w-md shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deals, crops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger className="w-[120px] text-xs">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All States</SelectItem>
                <SelectItem value="Punjab">Punjab</SelectItem>
                <SelectItem value="Haryana">Haryana</SelectItem>
                <SelectItem value="Madhya Pradesh">M.P.</SelectItem>
                <SelectItem value="Maharashtra">Maharashtra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Deals Grid ──────────────────────────────────────────────── */}
      {filteredDeals.length === 0 ? (
        <Card className="bg-card border border-dashed py-12">
          <CardContent className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Handshake className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">No Deals Found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              No direct deals match your active filters. Try searching for other crops or clear filters.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setActiveTab("all");
                setSelectedState("All");
              }}
              className="text-xs"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredDeals.map((deal) => {
            const isGroupBuy = deal.category === "group_buying";
            const isSupply = deal.category === "bulk_supply";
            const isMachinery = deal.category === "machinery_rental";
            const isContract = deal.category === "contracts";

            return (
              <Card
                key={deal.id}
                className={`bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between border ${
                  deal.isUserCreated
                    ? "border-primary/40 shadow-sm shadow-primary/5 bg-primary/[0.01]"
                    : "border-border/60"
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Category & Custom badge */}
                  <div className="flex justify-between items-start">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${
                        isSupply
                          ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/10"
                          : isGroupBuy
                          ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 border-amber-500/10"
                          : isMachinery
                          ? "bg-sky-500/10 text-sky-700 hover:bg-sky-500/10 border-sky-500/10"
                          : "bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/10 border-indigo-500/10"
                      }`}
                    >
                      {isSupply
                        ? "🌾 Crop Supply"
                        : isGroupBuy
                        ? "📦 Group Order"
                        : isMachinery
                        ? "🚜 Shared Machinery"
                        : "🤝 wholesale contract"}
                    </Badge>

                    {deal.isUserCreated && (
                      <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                        My Posted Deal
                      </Badge>
                    )}
                  </div>

                  {/* Title & Item description */}
                  <div>
                    <h3 className="font-bold text-foreground hover:text-primary transition-colors line-clamp-1">
                      {deal.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-semibold">
                      <span>Item: {deal.item}</span>
                    </div>
                  </div>

                  {/* Primary Details Row */}
                  <div className="grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg border text-xs">
                    <div>
                      <p className="text-muted-foreground font-medium">Budget / Rate</p>
                      <p className="font-bold text-foreground font-mono mt-0.5">{deal.price}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Quantity / Period</p>
                      <p className="font-bold text-foreground font-mono mt-0.5">{deal.quantity}</p>
                    </div>
                  </div>

                  {/* Pool progress (Group buy only) */}
                  {isGroupBuy && deal.poolFilled !== undefined && (
                    <div className="space-y-1.5 bg-amber-500/[0.02] border border-amber-500/10 p-2.5 rounded-lg">
                      <div className="flex justify-between text-[11px] font-bold text-amber-800">
                        <span>Group buying Pool</span>
                        <span>{deal.poolFilled}% Filled</span>
                      </div>
                      <div className="w-full bg-amber-200/40 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${deal.poolFilled}%` }}
                        ></div>
                      </div>
                      <p className="text-[10px] text-amber-700/80 font-medium">
                        Need remaining quota to secure bulk discount from wholesale merchant.
                      </p>
                    </div>
                  )}

                  {/* Deal descriptions */}
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {deal.description}
                  </p>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-muted/30 border-t border-border/40 flex justify-between items-center text-xs">
                  <div className="flex flex-col text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                      {deal.location}, {deal.state}
                    </span>
                    <span className="mt-1 font-semibold flex items-center gap-1">
                      By: {deal.contactName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {deal.isUserCreated ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteDeal(deal.id)}
                        className="text-destructive hover:bg-destructive/10 text-xs gap-1 h-8 px-2.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setContactingDeal(deal);
                          setInquiryText(`Hello ${deal.contactName}, I am very interested in your deal "${deal.title}" listed in ${deal.location}. I have active volume/capacity. Let's discuss details!`);
                        }}
                        className="text-xs bg-primary hover:bg-primary/95 text-primary-foreground font-semibold h-8"
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Post Deal Dialogue ────────────────────────────────────────── */}
      {isNewDealOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg bg-card shadow-xl border overflow-hidden max-h-[90vh] flex flex-col justify-between">
            <CardHeader className="border-b p-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                    <Handshake className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Post A New Deal</CardTitle>
                    <CardDescription className="text-xs">Publish direct transactions or pool offers</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsNewDealOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <form onSubmit={handlePostDeal} className="overflow-y-auto p-5 space-y-4 flex-1">
              {/* Category selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Deal Category</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "bulk_supply", label: "🌾 Bulk Supply" },
                    { id: "group_buying", label: "📦 Group Buying" },
                    { id: "machinery_rental", label: "🚜 Machine Sharing" },
                    { id: "contracts", label: "🤝 Wholesale Contract" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewCategory(cat.id as any)}
                      className={`p-2 rounded-lg border text-xs font-bold text-left transition-colors ${
                        newCategory === cat.id
                          ? "bg-primary/10 text-primary border-primary"
                          : "bg-background text-muted-foreground border-border/80 hover:bg-muted"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold" htmlFor="deal-title">Deal Title</Label>
                <Input
                  id="deal-title"
                  placeholder="e.g. Bulk Paddy CSR-30 Sale / DAP Co-order"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>

              {/* Crop Select & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Item / Crop</Label>
                  <Select value={newItem} onValueChange={setNewItem}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[220px]">
                      {allCrops.filter(c => c !== "All").map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                      <SelectItem value="DAP Fertilizer">DAP Fertilizer</SelectItem>
                      <SelectItem value="Urea Fertilizer">Urea Fertilizer</SelectItem>
                      <SelectItem value="Tractor Sharing">Tractor Sharing</SelectItem>
                      <SelectItem value="Harvester Sharing">Combined Harvester</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold" htmlFor="deal-price">Price Rate</Label>
                  <Input
                    id="deal-price"
                    placeholder="e.g. ₹2,100/q or ₹1,200/bag"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>
              </div>

              {/* Quantity & Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold" htmlFor="deal-qty">Quantity Offered/Target</Label>
                  <Input
                    id="deal-qty"
                    placeholder="e.g. 15 Tons or 50 Bags"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold" htmlFor="deal-phone">Your Mobile Phone</Label>
                  <Input
                    id="deal-phone"
                    placeholder="e.g. 98150-XXXXX"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>
              </div>

              {/* Location State and Mandi */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">State Location</Label>
                  <Select value={newState} onValueChange={setNewState}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Punjab">Punjab</SelectItem>
                      <SelectItem value="Haryana">Haryana</SelectItem>
                      <SelectItem value="Madhya Pradesh">Madhya Pradesh</SelectItem>
                      <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                      <SelectItem value="Uttar Pradesh">Uttar Pradesh</SelectItem>
                      <SelectItem value="Rajasthan">Rajasthan</SelectItem>
                      <SelectItem value="Gujarat">Gujarat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold" htmlFor="deal-mandi">Mandi/Town Location</Label>
                  <Input
                    id="deal-mandi"
                    placeholder="e.g. Rajpura APMC"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold" htmlFor="deal-desc">Description & Special Terms</Label>
                <textarea
                  id="deal-desc"
                  placeholder="Detail the quality, delivery rules, or seed agency details here so other farmers understand clearly..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
              </div>
            </form>

            <div className="border-t p-5 bg-muted/40 flex justify-end gap-3 shrink-0">
              <Button variant="outline" className="text-xs" onClick={() => setIsNewDealOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePostDeal} className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                Publish Live Deal
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Express Interest Dialogue (Connect Modal) ────────────────────── */}
      {contactingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-card shadow-xl border overflow-hidden">
            <CardHeader className="border-b p-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Express Direct Interest</CardTitle>
                    <CardDescription className="text-xs">Send inquiry for "{contactingDeal.title}"</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setContactingDeal(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <form onSubmit={handleSendInquiry} className="p-5 space-y-4">
              <div className="bg-primary/5 rounded-lg p-3.5 border border-primary/20 text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-foreground">
                  <span>Contact Person:</span>
                  <span>{contactingDeal.contactName}</span>
                </div>
                <div className="flex justify-between text-muted-foreground font-semibold">
                  <span>Direct Mobile No:</span>
                  <span className="text-foreground font-mono flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    {contactingDeal.contactPhone}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground font-semibold">
                  <span>Base Location:</span>
                  <span>{contactingDeal.location} ({contactingDeal.state})</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold" htmlFor="inquiry-msg">Your Direct Message</Label>
                <textarea
                  id="inquiry-msg"
                  value={inquiryText}
                  onChange={(e) => setInquiryText(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
              </div>

              <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3 flex gap-2.5 items-start text-[11px] text-amber-800">
                <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  By pressing send, your contact profile details (Name and verified account status) are securely sent. We also recommend calling the direct phone number listed.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" type="button" className="text-xs" onClick={() => setContactingDeal(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                  Send Direct Inquiry
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
