import React, { createContext, useContext, useState, useEffect } from "react";

interface MockUser {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  emailAddresses: Array<{ emailAddress: string }>;
}

const mockDefaultUser: MockUser = {
  id: "user_demo123",
  fullName: "Kisan Dev",
  firstName: "Kisan",
  lastName: "Dev",
  imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
  emailAddresses: [{ emailAddress: "demo-farmer@farmsphere.in" }],
};

interface ClerkContextType {
  user: MockUser | null;
  setUser: (user: MockUser | null) => void;
  isLoaded: boolean;
  isSignedIn: boolean;
}

const ClerkContext = createContext<ClerkContextType | null>(null);

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(() => {
    const saved = localStorage.getItem("clerk_mock_user");
    return saved ? JSON.parse(saved) : mockDefaultUser;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("clerk_mock_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("clerk_mock_user");
    }
  }, [user]);

  return (
    <ClerkContext.Provider value={{ user, setUser, isLoaded: true, isSignedIn: !!user }}>
      {children}
    </ClerkContext.Provider>
  );
}

export function useClerk() {
  const context = useContext(ClerkContext);
  return {
    signOut: async (options?: { redirectUrl?: string }) => {
      context?.setUser(null);
      if (options?.redirectUrl) {
        window.location.href = options.redirectUrl;
      }
    },
    signIn: async () => {
      context?.setUser(mockDefaultUser);
    },
    signUp: async () => {
      context?.setUser(mockDefaultUser);
    },
    addListener: () => {
      return () => {};
    },
    client: {},
    session: {},
  };
}

export function useUser() {
  const context = useContext(ClerkContext);
  return {
    user: context?.user ?? null,
    isLoaded: true,
    isSignedIn: context?.isSignedIn ?? false,
  };
}

export function SignedIn({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser();
  return isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser();
  return !isSignedIn ? <>{children}</> : null;
}

export function Show({ when, children }: { when: "signed-in" | "signed-out"; children: React.ReactNode }) {
  const { isSignedIn } = useUser();
  if (when === "signed-in" && isSignedIn) return <>{children}</>;
  if (when === "signed-out" && !isSignedIn) return <>{children}</>;
  return null;
}

export function SignIn() {
  const context = useContext(ClerkContext);
  const [email, setEmail] = useState("demo-farmer@farmsphere.in");
  const [fullName, setFullName] = useState("Kisan Dev");
  const [password, setPassword] = useState("password");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = fullName.trim().split(" ");
    const firstName = parts[0] || "Kisan";
    const lastName = parts.slice(1).join(" ") || "Dev";

    context?.setUser({
      id: "user_demo123",
      fullName: fullName.trim(),
      firstName,
      lastName,
      imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
      emailAddresses: [{ emailAddress: email }],
    });
    // Redirect to home dashboard
    window.location.href = window.location.pathname.replace(/\/sign-in\/?$/, "") || "/";
  };

  return (
    <div className="bg-card text-card-foreground p-6 rounded-2xl border border-border shadow-xl space-y-4 max-w-sm mx-auto w-full">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold">Demo Authentication</h2>
        <p className="text-xs text-muted-foreground">Sign in to explore Farm Sphere instantly</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
            required
            placeholder="e.g. Kisan Dev"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/95 transition-colors text-sm"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}

export function SignUp() {
  return <SignIn />;
}

export const UserButton = () => null;

export function publishableKeyFromHost() {
  return "pk_test_mock_key_for_clerk";
}

