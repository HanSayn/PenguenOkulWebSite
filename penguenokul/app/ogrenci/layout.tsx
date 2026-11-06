import AppShell from "@/components/layout/AppShell";

const items = [
  { href: "/ogrenci", label: "Panel" },
  { href: "/ogrenci/ders-al", label: "Ders al" },
  { href: "/ogrenci/derslerim", label: "Derslerim" },
  { href: "/ogrenci/odevler", label: "Ödevlerim" },
  { href: "/ogrenci/mesajlar", label: "Mesajlar" },
  { href: "/ogrenci/bildirimler", label: "Bildirimler" },
  { href: "/ogrenci/paketler", label: "Paketler" },
  { href: "/ogrenci/odemeler", label: "Ödemeler" },
  { href: "/ogrenci/destek", label: "Destek" },
  { href: "/ogrenci/profil", label: "Profil" },
];

export default function OgrenciLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell roleLabel="Öğrenci" items={items}>
      {children}
    </AppShell>
  );
}
