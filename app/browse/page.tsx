import BrowseView from "@/components/BrowseView";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function BrowsePage({ searchParams }: PageProps) {
  return <BrowseView searchParams={searchParams} />;
}

