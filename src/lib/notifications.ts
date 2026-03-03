export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notification");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const sendNotification = async (title: string, body: string, icon?: string): Promise<void> => {
  const hasPermission = await requestNotificationPermission();
  
  if (hasPermission) {
    new Notification(title, {
      body,
      icon: icon || "/icon-192x192.png",
      badge: "/icon-192x192.png",
    });
  }
};

export const notifyIpoStatusChange = async (ipoName: string, oldStatus: string, newStatus: string): Promise<void> => {
  await sendNotification(
    "Halka Arz Durumu Güncellendi",
    `${ipoName}: ${oldStatus} → ${newStatus}`
  );
};
