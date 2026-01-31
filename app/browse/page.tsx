import BrowseView from "@/components/BrowseView";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function BrowsePage({ searchParams }: PageProps) {
  return <BrowseView searchParams={searchParams} />;
}

