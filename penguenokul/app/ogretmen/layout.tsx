import AppShell from "@/components/layout/AppShell";

const items = [
  { href: "/ogretmen", label: "Panel" },
  { href: "/ogretmen/talepler", label: "Talepler" },
  { href: "/ogretmen/takvim", label: "Takvim" },
  { href: "/ogretmen/ogrencilerim", label: "Öğrencilerim" },
  { href: "/ogretmen/mesajlar", label: "Mesajlar" },
  { href: "/ogretmen/bildirimler", label: "Bildirimler" },
  { href: "/ogretmen/kazanc", label: "Kazanç" },
  { href: "/ogretmen/destek", label: "Destek" },
  { href: "/ogretmen/profil", label: "Profil" },
];

export default function OgretmenLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell roleLabel="Öğretmen" items={items}>
      {children}
    </AppShell>
  );
}
