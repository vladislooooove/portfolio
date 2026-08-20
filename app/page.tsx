import Loader from "@/components/Loader";
import Cursor from "@/components/Cursor";
import SmoothScroll from "@/components/SmoothScroll";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Ticker from "@/components/Ticker";
import Work from "@/components/Work";
import DeepDive from "@/components/DeepDive";
import Impact from "@/components/Impact";
import Capabilities from "@/components/Capabilities";
import Timeline from "@/components/Timeline";
import Stack from "@/components/Stack";
import Voices from "@/components/Voices";
import UpworkWall from "@/components/UpworkWall";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Page() {
  return (
    <>
      <Loader />
      <Cursor />
      <SmoothScroll />
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <Work />
        <DeepDive />
        <Impact />
        <Capabilities />
        <Timeline />
        <Stack />
        <Voices />
        <UpworkWall />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
