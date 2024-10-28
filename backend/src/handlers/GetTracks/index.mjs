export const handler = async (event) => {
    try {
      // Assuming the data is retrieved from some service or database
      const plannedTracks = ["ML inside track"];
  
      // Return a successful response
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ plannedTracks })
      };
    } catch (error) {
      // Return an error response if something goes wrong
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "The system encountered an error while retrieving the student's track information."
        })
      };
    }
  };