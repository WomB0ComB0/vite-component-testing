import { Card, CardContent, CardDescription, CardHeader, CardTitle} from "./components/ui/card"
import { Button } from "./components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog"
import ImageCarousel from "./ImageCarousel"
export const BlurCard = () => {
  return (
    <main
      style={{
        height: "100dvh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100dvw",
        overflow: "hidden",
      }}
    >
      <Card
        style={{
          width: "340px",
          maxHeight: "fit-content",
          height: "600px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-around",
          border: "1px solid black",
          borderRadius: "15px",
          boxShadow: "0 0 10px rgba(0,0,0,0.5)",
          padding: "10px",
          zIndex: 10,
          backgroundColor: "rgba(255,255,255,0.1)",
          position: "absolute",
          backdropFilter: "blur(40px)",
        }}
      >
        <CardHeader>
          {/* Image */}
          <img src="https://github.com/WomB0ComB0.png" alt="" width={200} height={200}/>
          <CardTitle>
            Mike Odnis
          </CardTitle>
          <CardDescription>
            This is a description
          </CardDescription>
          {/* Map initial links here */}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="links">
            <TabsList>
              <TabsTrigger value="links">
                Links
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming
              </TabsTrigger>
              <TabsTrigger value="past">
                Past
              </TabsTrigger>
            </TabsList>
            <TabsContent value="links">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Links
                  </CardTitle>
                  <CardDescription>
                    These are all the relevant links
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    {/* Map starts here */}
                    <DialogTrigger asChild>
                      <Button>
                        Show Dialog
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Share this link
                        </DialogTitle>
                      </DialogHeader>
                      {/* Map here */}
                      {["https://github.com/Womb0Comb0", "https://linkedin.com/mikeodnis", "https://mikeodnis.com"].map((link, index) => (
                        <Button key={index} onClick={() => window.open(link, '_blank', 'noopener')}>
                          {link.replace(/https?:\/\//, '')}
                        </Button>
                      ))}
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="upcoming">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Upcoming Events
                  </CardTitle>
                  <CardDescription>
                    These are all upcoming events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    {/* Map starts here */}
                    <DialogTrigger asChild>
                      <Button>
                        Show Dialog
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Share this link
                        </DialogTitle>
                      </DialogHeader>
                      {/* Map here */}
                      {["https://github.com/Womb0Comb0", "https://linkedin.com/mikeodnis", "https://mikeodnis.com"].map((link, index) => (
                        <Button key={index} onClick={() => window.open(link, '_blank', 'noopener')}>
                          {link.replace(/https?:\/\//, '')}
                        </Button>
                      ))}
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="past">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Past Events
                  </CardTitle>
                  <CardDescription>
                    These are all past events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    style={{
                      border: "1px solid black",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}
                  >
                    
                    <img src="https://github.com/WomB0ComB0.png" width={40} height={40} alt="" />
                    <p>
                      hello
                    </p>
                  <Dialog>
                    {/* Map starts here */}
                    <DialogTrigger asChild style={{
                      border: "1px solid black",
                      
                    }}>
                      <Button>
                        Show Dialog

                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Share this link
                        </DialogTitle>
                      </DialogHeader>
                      {/* Map here */}
                      {["https://github.com/Womb0Comb0", "https://linkedin.com/mikeodnis", "https://mikeodnis.com"].map((link, index) => (
                        <Button key={index} onClick={() => window.open(link, '_blank', 'noopener')}>
                          {link.replace(/https?:\/\//, '')}
                        </Button>
                      ))}
                    </DialogContent>
                  </Dialog>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <ImageCarousel />
    </main>
  )
}