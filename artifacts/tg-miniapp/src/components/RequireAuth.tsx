import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("automod_api_token"));
  const [inputValue, setInputValue] = useState("");

  const handleSave = () => {
    if (inputValue.trim()) {
      localStorage.setItem("automod_api_token", inputValue.trim());
      setToken(inputValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-background text-foreground">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">AutoMod Business</h1>
            <p className="text-sm text-muted-foreground">
              Введите API-токен для доступа к панели управления.
            </p>
          </div>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="API-токен"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button className="w-full" onClick={handleSave}>
              Войти
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
