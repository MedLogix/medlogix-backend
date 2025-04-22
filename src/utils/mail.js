import Mailgen from "mailgen";
import nodemailer from "nodemailer";
import logger from "../logger/winston.logger.js";

/**
 *
 * @param {{email: string; subject: string; mailgenContent: Mailgen.Content; }} options
 */
const sendEmail = async (options) => {
  // Initialize mailgen instance with default theme and brand configuration
  const mailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "Medlogix",
      link: "https://medlogix.com",
    },
  });

  // For more info on how mailgen content work visit https://github.com/eladnava/mailgen#readme
  // Generate the plaintext version of the e-mail (for clients that do not support HTML)
  const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);

  // Generate an HTML email with the provided contents
  const emailHtml = mailGenerator.generate(options.mailgenContent);

  // Create a nodemailer transporter instance which is responsible to send a mail
  const transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_SMTP_HOST,
    port: process.env.MAILTRAP_SMTP_PORT,
    auth: {
      user: process.env.MAILTRAP_SMTP_USER,
      pass: process.env.MAILTRAP_SMTP_PASS,
    },
  });

  const mail = {
    from: "mail.freeapi@gmail.com", // We can name this anything. The mail will go to your Mailtrap inbox
    to: options.email, // receiver's mail
    subject: options.subject, // mail subject
    text: emailTextual, // mailgen content textual variant
    html: emailHtml, // mailgen content html variant
  };

  try {
    await transporter.sendMail(mail);
  } catch (error) {
    // As sending email is not strongly coupled to the business logic it is not worth to raise an error when email sending fails
    // So it's better to fail silently rather than breaking the app
    logger.error(
      "Email service failed silently. Make sure you have provided your MAILTRAP credentials in the .env file"
    );
    logger.error("Error: ", error);
  }
};

/**
 *
 * @param {string} username
 * @param {string} verificationUrl
 * @returns {Mailgen.Content}
 * @description It designs the email verification mail
 */
const emailVerificationMailgenContent = (username, verificationUrl) => {
  return {
    body: {
      name: username,
      intro: "Welcome to our app! We're very excited to have you on board.",
      action: {
        instructions:
          "To verify your email please click on the following button:",
        button: {
          color: "#3d61ff", // Optional action button color
          text: "Verify your email",
          link: verificationUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

/**
 *
 * @param {string} username
 * @param {string} verificationUrl
 * @returns {Mailgen.Content}
 * @description It designs the forgot password mail
 */
const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
  return {
    body: {
      name: username,
      intro: "We got a request to reset the password of our account",
      action: {
        instructions:
          "To reset your password click on the following button or link:",
        button: {
          color: "#22BC66", // Optional action button color
          text: "Reset password",
          link: passwordResetUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

const newRequirementSubmittedMailgenContent = ({
  recipientName,
  institutionName,
  requirementId,
  viewRequirementUrl,
}) => {
  return {
    body: {
      name: recipientName,
      intro: `A new requirement (${requirementId}) has been submitted by ${institutionName} and requires your attention.`,
      action: {
        instructions:
          "Please review the new requirement details by clicking the button below:",
        button: {
          color: "#3d61ff",
          text: "View Requirement",
          link: viewRequirementUrl,
        },
      },
      outro: "Please process this requirement at your earliest convenience.",
    },
  };
};

const requirementStatusUpdateMailgenContent = ({
  recipientName,
  requirementId,
  newStatus,
  warehouseName,
  viewRequirementUrl,
}) => {
  let intro = `The status of your requirement (${requirementId}) has been updated by ${warehouseName}.`;
  let outro = "If you have any questions, please contact the warehouse.";

  switch (newStatus.toLowerCase()) {
    case "Approved":
      intro += ` It has been fully approved.`;
      outro = "Preparation for shipment will begin soon.";
      break;
    case "Rejected":
      intro += ` Unfortunately, it has been rejected.`;
      outro = "Please contact the warehouse for more details or clarification.";
      break;
    default:
      intro += ` The new status is: ${newStatus}.`;
  }

  return {
    body: {
      name: recipientName,
      intro: intro,
      action: {
        instructions:
          "You can view the details of your requirement by clicking the button below:",
        button: {
          color: "#3d61ff",
          text: "View Requirement Details",
          link: viewRequirementUrl,
        },
      },
      outro: outro,
    },
  };
};

/**
 * Generates the email content for a shipment dispatch notification.
 * @param {string} recipientName Name of the institution user receiving the mail.
 * @param {string} shipmentId User-friendly ID or reference for the shipment.
 * @param {string} requirementId The related requirement ID.
 * @param {string} warehouseName The name of the dispatching warehouse.
 * @param {string} viewShipmentUrl Direct link for the recipient to track the shipment.
 * @returns {Mailgen.Content}
 */
const shipmentDispatchedMailgenContent = ({
  recipientName,
  shipmentId,
  requirementId,
  warehouseName,
  viewShipmentUrl,
}) => {
  return {
    body: {
      name: recipientName,
      intro: `Good news! Your order (Requirement: ${requirementId}) has been dispatched from ${warehouseName} under Shipment ID: ${shipmentId}.`,
      action: {
        instructions:
          "You can view the shipment details and estimated delivery time (if available) using the button below:",
        button: {
          color: "#22BC66",
          text: "Track Shipment",
          link: viewShipmentUrl,
        },
      },
      outro: "Please be ready to receive the shipment upon arrival.",
    },
  };
};

const shipmentDeliveredMailgenContent = ({
  recipientName,
  shipmentId,
  warehouseName,
  confirmReceiptUrl,
}) => {
  return {
    body: {
      name: recipientName,
      intro: `Your shipment (${shipmentId}) from ${warehouseName} has been marked as delivered by the logistics team.`,
      action: {
        instructions:
          "Please confirm the receipt of the items after verifying the delivery contents:",
        button: {
          color: "#3d61ff",
          text: "Confirm Receipt",
          link: confirmReceiptUrl,
        },
      },
      outro:
        "If there are any issues with the delivery, please contact the warehouse immediately.",
    },
  };
};

const shipmentReceivedMailgenContent = ({
  recipientName,
  shipmentId,
  institutionName,
  viewShipmentUrl,
}) => {
  return {
    body: {
      name: recipientName,
      intro: `Shipment ${shipmentId} has been successfully received and confirmed by ${institutionName}.`,
      action: {
        instructions:
          "You can view the final details of the completed shipment:",
        button: {
          color: "#22BC66",
          text: "View Shipment Details",
          link: viewShipmentUrl,
        },
      },
      outro:
        "This shipment process is now complete. No further action is required.",
    },
  };
};

const registrationStatusMailgenContent = ({
  recipientName,
  isApproved,
  rejectionReason = "",
  loginUrl = "",
}) => {
  let intro;
  let action = null; // No action button by default

  if (isApproved) {
    intro =
      "Congratulations! Your registration request for Medlogix has been approved by the administrator.";
    action = {
      instructions:
        "You can now log in to your account using the credentials you provided:",
      button: {
        color: "#22BC66",
        text: "Login to Medlogix",
        link: loginUrl,
      },
    };
  } else {
    intro =
      "We regret to inform you that your registration request for Medlogix has been rejected by the administrator.";
    if (rejectionReason) {
      intro += ` Reason provided: ${rejectionReason}`;
    }
  }

  return {
    body: {
      name: recipientName,
      intro: intro,
      action: action, // Include action only if approved
      outro: isApproved
        ? "We're excited to have you on board!"
        : "If you believe this was an error or have questions, please contact support.",
    },
  };
};

/**
 * Generates the email content for a stock expiry alert.
 * @param {string} recipientName Name of the institution/warehouse contact receiving the mail.
 * @param {Array<object>} expiringItems Array of objects, each containing details of an expiring item (e.g., { medicineName: string, batchName: string, expiryDate: string, quantity: number, unit: string }).
 * @param {string} entityName Name of the institution or warehouse.
 * @param {string} [viewStockUrl] Optional link for the recipient to view their stock.
 * @returns {Mailgen.Content}
 */
const stockExpiryAlertMailgenContent = ({
  recipientName,
  expiringItems,
  entityName,
  viewStockUrl = "", // Optional: Link to stock management page
}) => {
  // Prepare the table data
  const tableData = expiringItems.map((item) => ({
    Medicine: item.medicineName,
    Batch: item.batchName,
    "Expiry Date": item.expiryDate, // Assuming pre-formatted date string
    Quantity: `${item.quantity} ${item.unit}`,
  }));

  const mailContent = {
    body: {
      name: recipientName,
      intro: [
        `This is an alert regarding stock items expiring soon at ${entityName}.`,
        `The following items are set to expire within the next month or are already expired:`,
      ],
      table: {
        data: tableData,
        columns: {
          // Optionally customize column widths
          // customWidth: {
          //   Medicine: '20%',
          //   'Expiry Date': '15%'
          // }
        },
      },
      outro: [
        "Please review your inventory and take appropriate action for these items.",
        viewStockUrl
          ? "You can manage your stock here:"
          : "Consider rotating stock or planning for disposal/return as needed.",
      ],
    },
  };

  // Add action button if URL is provided
  if (viewStockUrl) {
    mailContent.body.action = {
      instructions: "Click the button below to view your current stock levels:",
      button: {
        color: "#FFC107", // Warning color
        text: "View Stock",
        link: viewStockUrl,
      },
    };
  }

  return mailContent;
};

export {
  sendEmail,
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  newRequirementSubmittedMailgenContent,
  requirementStatusUpdateMailgenContent,
  shipmentDispatchedMailgenContent,
  shipmentDeliveredMailgenContent,
  shipmentReceivedMailgenContent,
  registrationStatusMailgenContent,
  stockExpiryAlertMailgenContent,
};
