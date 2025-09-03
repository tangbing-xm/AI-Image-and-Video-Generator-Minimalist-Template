import WorkerWrapper from "@/components/replicate/img-to-video/worker-wraper";
import TopHero from "@/components/landingpage/top";
import What from "@/components/landingpage/what";
import How from "@/components/landingpage/how";
import Faq from "@/components/landingpage/faq";
import FeatureHero from "@/components/landingpage/feature";
import { getMetadata } from "@/components/seo/seo";
import UserExample from "@/components/landingpage/example";
import Cta from "@/components/landingpage/cta";

export async function generateMetadata({
  params,
}: {
  params: { locale?: string };
}) {
  return await getMetadata(params?.locale || "", "HomePage.seo", "");
}

export default function Home({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const images = [
    {
      img: "/img/example1.webp",
      video: "/img/example1.mp4",
    },
    {
      img: "/img/example2.webp",
      video: "/img/example2.mp4",
    },
    {
      img: "/img/example5.webp",
      video: "/img/example5.mp4",
    },
  ];

  const video = "/img/example1.mp4";
  const whatImage = "/img/example2.webp";
  const howImage = "/img/example5.webp";

  return (
    <main className="flex flex-col items-center rounded-2xl px-3 md:rounded-3xl md:px-0">
      <div className="py-10 ">
        <TopHero multiLanguage={"HomePage"} locale={locale} />
      </div>
      <div className="w-full flex justify-center items-center pt-3 mb-8">
        <WorkerWrapper
          effectId="1"
          promotion={video}
          defaultMode="single"
          showMode={false}
          lang="HomePage.generator"
        />
      </div>
      <div className="pt-20 md:pt-40">
        <UserExample multiLanguage={"HomePage"} images={images} />
      </div>

      <div className="pt-20 md:pt-40 w-full">
        <What multiLanguage={"HomePage"} image={whatImage} />
      </div>

      <div className="pt-20 md:pt-40 w-full">
        <How multiLanguage={"HomePage"} image={howImage} />
      </div>

      <div className="pt-20 md:pt-40 w-full">
        <FeatureHero multiLanguage={"HomePage"} />
      </div>

      <div className="pt-20 md:pt-40 w-full">
        <Faq multiLanguage={"HomePage"} grid={true} />
      </div>

      <div className="py-20 md:py-40 w-full">
        <Cta multiLanguage={"HomePage"} />
      </div>
    </main>
  );
}
